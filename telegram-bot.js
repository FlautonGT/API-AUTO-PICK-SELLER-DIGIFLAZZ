/**
 * Telegram Bot Handler untuk konfirmasi kode produk
 */

import TelegramBot from 'node-telegram-bot-api';
import { generateProductCode, makeUniqueCode } from './product-code-config.js';

// Re-export for backward compatibility
const generateAutoCode = generateProductCode;

export class TelegramProductCodeBot {
    constructor(token, chatId) {
        this.bot = new TelegramBot(token, { polling: true });
        this.chatId = chatId;
        this.pendingRequests = new Map();
        this.codeMode = null; // 'manual' atau 'auto'
        this.isInitialized = false;
        this.modePromiseResolver = null;
        this.generatedCodes = new Set(); // Track codes yang sudah di-generate
        this.setupListeners();
    }

    setupListeners() {
        this.bot.on('message', async (msg) => {
            if (msg.chat.id.toString() !== this.chatId.toString()) return;
            if (!msg.reply_to_message) return;
            
            const replyToId = msg.reply_to_message.message_id;
            const pending = this.pendingRequests.get(replyToId);
            
            if (pending && pending.type === 'code') {
                const code = msg.text.trim().toUpperCase();
                await this.confirmProductCode(code, pending);
            }
            // Handle XSRF_TOKEN reply
            else if (pending && pending.type === 'xsrf_token') {
                const token = msg.text.trim();
                await this.handleXSRFTokenReply(token, replyToId, pending);
            }
            // Handle COOKIE reply
            else if (pending && pending.type === 'cookie') {
                const cookie = msg.text.trim();
                await this.handleCookieReply(cookie, replyToId, pending);
            }
        });

        this.bot.on('callback_query', async (query) => {
            await this.bot.answerCallbackQuery(query.id);
            
            const data = query.data;
            
            // Handle code mode selection (startup)
            if (data.startsWith('mode_')) {
                const mode = data.replace('mode_', '');
                await this.handleModeSelection(mode, query.message.message_id);
            }
            // Handle seller confirmation
            else if (data.startsWith('seller_')) {
                const action = data.replace('seller_', '');
                await this.handleSellerAction(action, query.message.message_id);
            }
            // Handle code confirmation
            else if (data.startsWith('code_')) {
                const [_, action, code] = data.split('_');
                await this.handleCodeConfirmation(action, code, query.message.message_id);
            }
            // Handle auto code confirmation
            else if (data.startsWith('autocode_')) {
                const parts = data.split('_');
                const action = parts[1]; // 'yes' atau 'no'
                const code = parts.slice(2).join('_'); // code bisa mengandung underscore
                await this.handleAutoCodeConfirmation(action, code, query.message.message_id);
            }
            // Handle quota continue
            else if (data === 'quota_continue') {
                await this.handleQuotaContinue(query.message.message_id);
            }
        });
    }

    /**
     * Request code mode selection at startup
     */
    async requestCodeMode() {
        if (this.isInitialized && this.codeMode) {
            return this.codeMode;
        }

        const message = `
🚀 *Digi Picker Seller Started*

Pilih mode pembuatan kode produk:

📝 *Manual* - Anda akan diminta menulis kode untuk setiap produk
🤖 *Otomatis* - Kode dibuat otomatis berdasarkan kategori, brand, dan type

Contoh kode otomatis:
• Telkomsel 10.000 → \`S10\`
• Mobile Legend 86 Diamond → \`ML86\`
• PLN 50.000 → \`PLN50\`

⏰ *Time:* ${new Date().toLocaleString('id-ID')}
`;

        try {
            const sent = await this.bot.sendMessage(this.chatId, message, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '📝 Manual', callback_data: 'mode_manual' },
                            { text: '🤖 Otomatis', callback_data: 'mode_auto' }
                        ]
                    ]
                }
            });

            return new Promise((resolve) => {
                this.modePromiseResolver = resolve;
                this.pendingRequests.set(sent.message_id, {
                    type: 'mode',
                    resolve
                });
            });
        } catch (error) {
            console.error('Failed to send mode selection:', error);
            // Default to manual if failed
            return 'manual';
        }
    }

    async handleModeSelection(mode, messageId) {
        this.codeMode = mode;
        this.isInitialized = true;

        const modeText = mode === 'auto' ? '🤖 Otomatis' : '📝 Manual';
        
        await this.bot.editMessageText(
            `✅ Mode kode produk: *${modeText}*\n\nScript akan berjalan dengan mode ini.`,
            {
                chat_id: this.chatId,
                message_id: messageId,
                parse_mode: 'Markdown'
            }
        );

        // Resolve pending request
        const pending = this.pendingRequests.get(messageId);
        if (pending && pending.resolve) {
            this.pendingRequests.delete(messageId);
            pending.resolve(mode);
        }

        // Also resolve via modePromiseResolver if available
        if (this.modePromiseResolver) {
            this.modePromiseResolver(mode);
            this.modePromiseResolver = null;
        }
    }

    /**
     * Get current code mode
     */
    getCodeMode() {
        return this.codeMode;
    }

    /**
     * Track code as used (to avoid duplicates)
     */
    trackCode(code) {
        this.generatedCodes.add(code);
        this.generatedCodes.add(code + 'B1');
        this.generatedCodes.add(code + 'B2');
    }

    /**
     * Generate auto code and optionally confirm via Telegram
     */
    async generateAutoCodeWithConfirmation(productData, skipConfirmation = false) {
        const { category, brand, type, product } = productData;
        
        // Generate code and make unique
        let autoCode = generateAutoCode(category, brand, type, product);
        autoCode = makeUniqueCode(autoCode, this.generatedCodes);
        
        // Track the code immediately to prevent duplicates
        this.trackCode(autoCode);
        
        if (skipConfirmation) {
            return autoCode;
        }

        // Send confirmation message
        const message = `
🤖 *Auto Generated Code*

📁 *Kategori:* ${category}
🏷️ *Brand:* ${brand}
📋 *Tipe:* ${type || 'Umum'}
📦 *Produk:* ${product}
🔑 *Kode:* \`${autoCode}\`

Gunakan kode ini?
`;

        try {
            const sent = await this.bot.sendMessage(this.chatId, message, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '✅ Ya', callback_data: `autocode_yes_${autoCode}` },
                            { text: '✏️ Ganti Manual', callback_data: `autocode_no_${autoCode}` }
                        ]
                    ]
                }
            });

            return new Promise((resolve) => {
                this.pendingRequests.set(sent.message_id, {
                    resolve,
                    type: 'autocode',
                    data: productData,
                    autoCode
                });
            });
        } catch (error) {
            // If failed to send, return auto code directly
            console.error('Failed to confirm auto code:', error);
            return autoCode;
        }
    }

    async handleAutoCodeConfirmation(action, code, messageId) {
        const pending = Array.from(this.pendingRequests.entries()).find(
            ([id, p]) => p.type === 'autocode' && this.pendingRequests.get(id)
        );

        if (!pending) return;

        const [pendingMsgId, pendingData] = pending;

        if (action === 'yes') {
            // Accept auto code
            await this.bot.editMessageText(
                `✅ Kode produk *${code}* dikonfirmasi!`,
                {
                    chat_id: this.chatId,
                    message_id: messageId,
                    parse_mode: 'Markdown'
                }
            );
            
            this.pendingRequests.delete(pendingMsgId);
            pendingData.resolve(code);
        } else {
            // Switch to manual input
            await this.bot.editMessageText(
                `✏️ Silakan tulis kode produk manual...\n\n📦 *Produk:* ${pendingData.data.product}`,
                {
                    chat_id: this.chatId,
                    message_id: messageId,
                    parse_mode: 'Markdown'
                }
            );

            // Request manual code
            this.pendingRequests.delete(pendingMsgId);
            const manualCode = await this.requestProductCode(pendingData.data);
            pendingData.resolve(manualCode);
        }
    }

    /**
     * Request seller confirmation with product details
     */
    async requestSellerConfirmation(productData, sellers, aiReasoning) {
        const { category, brand, type, product } = productData;
        
        let message = `
🤖 *Konfirmasi Seller & Produk*

📁 *Kategori:* ${category}
🏷️ *Brand:* ${brand}
📋 *Tipe:* ${type || 'Umum'}
📦 *Produk:* ${product}

👥 *Daftar Seller:*
`;

        sellers.forEach((seller, idx) => {
            const num = idx + 1;
            message += `
*${num}. ${seller.type}* - ${seller.seller || seller.name}
`;
            message += `   💰 Harga: Rp ${(seller.price || 0).toLocaleString('id-ID')}\n`;
            message += `   ⭐ Rating: ${seller.reviewAvg || seller.rating || 0}\n`;
            message += `   📦 Multi: ${seller.multi ? 'Ya' : 'Tidak'}\n`;
            message += `   🧾 Faktur: ${seller.faktur ? 'Ya' : 'Tidak'}\n`;
            message += `   📊 Stock: ${seller.unlimited_stock ? 'Unlimited' : 'Limited'}\n`;
            message += `   ✅ Status: ${seller.status ? 'Aktif' : 'Tidak Aktif'}\n`;
            message += `   ⏰ Cutoff: ${seller.start_cut_off || '00:00'} - ${seller.end_cut_off || '00:00'}\n`;
            message += `   📝 Desc: ${(seller.deskripsi || seller.description || '-').substring(0, 80)}...\n`;
        });

        message += `\n🧠 *AI Reasoning:*\n${aiReasoning || 'Seller dipilih berdasarkan kriteria optimal'}\n`;

        const buttons = [];
        if (sellers.length >= 1) buttons.push([{ text: '🔄 Ganti Main', callback_data: 'seller_main' }]);
        if (sellers.length >= 2) buttons.push([{ text: '🔄 Ganti B1', callback_data: 'seller_b1' }]);
        if (sellers.length >= 3) buttons.push([{ text: '🔄 Ganti B2', callback_data: 'seller_b2' }]);
        if (sellers.length >= 2) buttons.push([{ text: '🔄 Ganti Main & B1', callback_data: 'seller_main_b1' }]);
        if (sellers.length >= 3) buttons.push([{ text: '🔄 Ganti Main & B2', callback_data: 'seller_main_b2' }]);
        if (sellers.length >= 3) buttons.push([{ text: '🔄 Ganti B1 & B2', callback_data: 'seller_b1_b2' }]);
        buttons.push([{ text: '🔄 Ganti Semua', callback_data: 'seller_all' }]);
        buttons.push([{ text: '✅ Lanjutkan', callback_data: 'seller_continue' }]);

        try {
            const sent = await this.bot.sendMessage(this.chatId, message, {
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: buttons }
            });

            return new Promise((resolve) => {
                this.pendingRequests.set(sent.message_id, {
                    resolve,
                    type: 'seller',
                    data: productData,
                    sellers,
                    aiReasoning
                });
            });
        } catch (error) {
            throw new Error(`Failed to send seller confirmation: ${error.message}`);
        }
    }

    async handleSellerAction(action, messageId) {
        const pending = this.pendingRequests.get(messageId);
        if (!pending) return;

        if (action === 'continue') {
            await this.bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
                chat_id: this.chatId,
                message_id: messageId
            });
            
            this.pendingRequests.delete(messageId);
            pending.resolve({ action: 'continue', sellers: pending.sellers });
        } else {
            await this.bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
                chat_id: this.chatId,
                message_id: messageId
            });
            
            this.pendingRequests.delete(messageId);
            pending.resolve({ action: 'change', changeType: action, sellers: pending.sellers });
        }
    }

    /**
     * Request product code from owner
     */
    async requestProductCode(productData) {
        const { category, brand, type, product, skuCount } = productData;
        
        const message = `
📝 *Silakan Tuliskan Kode Produk*

📁 *Kategori:* ${category}
🏷️ *Brand:* ${brand}
📋 *Tipe:* ${type || 'Umum'}
📦 *Produk:* ${product}
🔢 *Jumlah SKU:* ${skuCount}

💬 *Reply pesan ini dengan kode produk*
`;

        try {
            const sent = await this.bot.sendMessage(this.chatId, message, {
                parse_mode: 'Markdown'
            });

            return new Promise((resolve) => {
                this.pendingRequests.set(sent.message_id, {
                    resolve,
                    type: 'code',
                    data: productData
                });
            });
        } catch (error) {
            throw new Error(`Failed to send code request: ${error.message}`);
        }
    }

    async confirmProductCode(code, pending) {
        const { category, brand, type, product } = pending.data;
        
        const message = `
✅ *Konfirmasi Kode Produk*

📁 *Kategori:* ${category}
🏷️ *Brand:* ${brand}
📋 *Tipe:* ${type || 'Umum'}
📦 *Produk:* ${product}
🔑 *Kode:* *${code}*

Apakah sudah benar?
`;

        try {
            const sent = await this.bot.sendMessage(this.chatId, message, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '✅ Ya', callback_data: `code_yes_${code}` },
                            { text: '❌ Tidak', callback_data: `code_no_${code}` }
                        ]
                    ]
                }
            });

            pending.confirmMessageId = sent.message_id;
        } catch (error) {
            throw new Error(`Failed to confirm code: ${error.message}`);
        }
    }

    async handleCodeConfirmation(action, code, messageId) {
        const pending = Array.from(this.pendingRequests.values()).find(p => p.confirmMessageId === messageId);
        if (!pending) return;

        if (action === 'yes') {
            await this.bot.editMessageText(
                `✅ Kode produk *${code}* dikonfirmasi!`,
                {
                    chat_id: this.chatId,
                    message_id: messageId,
                    parse_mode: 'Markdown'
                }
            );
            
            for (const [msgId, p] of this.pendingRequests.entries()) {
                if (p.confirmMessageId === messageId) {
                    this.pendingRequests.delete(msgId);
                    p.resolve(code);
                    break;
                }
            }
        } else {
            await this.bot.editMessageText(
                `❌ Kode ditolak. Reply pesan awal dengan kode baru.`,
                {
                    chat_id: this.chatId,
                    message_id: messageId
                }
            );
        }
    }

    /**
     * Send error notification
     * @param {Object|string} error - Error object or message
     * @param {string} context - Optional context string (for backward compatibility)
     */
    async sendErrorNotification(error, context = '') {
        let message;
        
        // Handle new structured error format
        if (error && typeof error === 'object' && error.type) {
            switch (error.type) {
                case 'AI_INSUFFICIENT_SELLERS':
                    message = `
⚠️ *AI Selection Warning*

📦 *Produk:* ${error.product || 'Unknown'}
❌ *Masalah:* ${error.message}

📊 *Detail:*
• Butuh: ${error.details?.needed || '?'} seller
• Dikembalikan AI: ${error.details?.returned || '?'} seller
• Kandidat tersedia: ${error.details?.available || '?'} seller
• Yang terpilih: ${error.details?.selected || '-'}

⏰ *Time:* ${new Date().toLocaleString('id-ID')}
`;
                    break;
                    
                case 'CHATGPT_ERROR':
                    message = `
🤖 *ChatGPT API Error*

📦 *Produk:* ${error.product || 'Unknown'}
❌ *Error:* ${error.message}

⏰ *Time:* ${new Date().toLocaleString('id-ID')}
`;
                    break;
                    
                case 'DIGIFLAZZ_ERROR':
                    message = `
🌐 *Digiflazz API Error*

📦 *Produk:* ${error.product || 'Unknown'}
❌ *Error:* ${error.message}

⏰ *Time:* ${new Date().toLocaleString('id-ID')}
`;
                    break;
                    
                default:
                    message = `
🚨 *Error Detected*

📍 *Type:* ${error.type}
📦 *Produk:* ${error.product || 'Unknown'}
❌ *Error:* ${error.message}

⏰ *Time:* ${new Date().toLocaleString('id-ID')}
`;
            }
        } else {
            // Handle legacy format (error object/string + context)
            message = `
🚨 *Error Detected*

${context ? `📍 *Context:* ${context}\n` : ''}
❌ *Error:* ${error.message || error}

⏰ *Time:* ${new Date().toLocaleString('id-ID')}
`;
        }

        try {
            await this.bot.sendMessage(this.chatId, message, {
                parse_mode: 'Markdown'
            });
        } catch (err) {
            console.error('Failed to send error notification:', err);
        }
    }

    /**
     * Send rate limit notification
     */
    async sendRateLimitNotification(service, retryCount, sleepDuration) {
        const message = `
⚠️ *Rate Limit Detected*

🌐 *Service:* ${service}
🔄 *Retry:* ${retryCount}
⏱️ *Sleep Duration:* ${sleepDuration / 1000}s

Script akan otomatis melanjutkan setelah sleep.
`;

        try {
            await this.bot.sendMessage(this.chatId, message, {
                parse_mode: 'Markdown'
            });
        } catch (err) {
            console.error('Failed to send rate limit notification:', err);
        }
    }

    /**
     * Send OpenAI quota exhausted notification with continue button
     */
    async sendQuotaExhaustedNotification() {
        const message = `
🚨 *QUOTA OPENAI TELAH HABIS*

❌ Script dihentikan sementara karena quota OpenAI habis.

📝 *Langkah yang perlu dilakukan:*
1. Buka https://platform.openai.com/usage
2. Periksa usage dan billing
3. Top up / isi ulang quota
4. Tekan tombol *Lanjutkan* di bawah

⏰ *Time:* ${new Date().toLocaleString('id-ID')}
`;

        try {
            const sent = await this.bot.sendMessage(this.chatId, message, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '▶️ Lanjutkan', callback_data: 'quota_continue' }
                        ]
                    ]
                }
            });

            // Return a promise that resolves when user clicks continue
            return new Promise((resolve) => {
                this.pendingRequests.set(sent.message_id, {
                    resolve,
                    type: 'quota_continue'
                });
            });
        } catch (err) {
            console.error('Failed to send quota exhausted notification:', err);
            throw err;
        }
    }

    /**
     * Handle quota continue callback
     */
    async handleQuotaContinue(messageId) {
        const pending = Array.from(this.pendingRequests.entries()).find(
            ([id, p]) => p.type === 'quota_continue'
        );

        if (!pending) return;

        const [pendingMsgId, pendingData] = pending;

        try {
            await this.bot.editMessageText(
                `✅ *Script Dilanjutkan*\n\n⏰ Dilanjutkan pada: ${new Date().toLocaleString('id-ID')}`,
                {
                    chat_id: this.chatId,
                    message_id: messageId,
                    parse_mode: 'Markdown'
                }
            );
        } catch (err) {
            console.error('Failed to edit quota message:', err);
        }

        this.pendingRequests.delete(pendingMsgId);
        pendingData.resolve(true);
    }

    /**
     * Send 401 unauthorized notification and request new credentials via reply
     * Returns a promise that resolves with { xsrfToken, cookie } when user provides both
     */
    async send401Notification() {
        // Step 1: Request XSRF_TOKEN
        const xsrfMessage = `
🔐 *Token Kadaluarsa (401 Unauthorized)*

Token Digiflazz sudah tidak valid.

📝 *Langkah 1/2: XSRF\\_TOKEN*

1. Buka https://member.digiflazz.com/buyer-area/product
2. Tekan F12 > Application > Cookies
3. Copy nilai *XSRF-TOKEN*
4. *Reply pesan ini* dengan XSRF\\_TOKEN

⏰ *Time:* ${new Date().toLocaleString('id-ID')}
`;

        try {
            const xsrfSent = await this.bot.sendMessage(this.chatId, xsrfMessage, {
                parse_mode: 'Markdown'
            });

            // Wait for XSRF_TOKEN reply
            const xsrfToken = await new Promise((resolve) => {
                this.pendingRequests.set(xsrfSent.message_id, {
                    resolve,
                    type: 'xsrf_token'
                });
            });

            // Step 2: Request COOKIE
            const cookieMessage = `
✅ *XSRF\\_TOKEN diterima!*

📝 *Langkah 2/2: COOKIE*

1. Di F12 > Network, refresh halaman
2. Klik request pertama (ke domain digiflazz)
3. Di Headers > Request Headers, copy nilai *Cookie*
4. *Reply pesan ini* dengan COOKIE

💡 Cookie biasanya dimulai dengan \`XSRF-TOKEN=...; digiflazz_session=...\`
`;

            const cookieSent = await this.bot.sendMessage(this.chatId, cookieMessage, {
                parse_mode: 'Markdown'
            });

            // Wait for COOKIE reply
            const cookie = await new Promise((resolve) => {
                this.pendingRequests.set(cookieSent.message_id, {
                    resolve,
                    type: 'cookie'
                });
            });

            // Confirm credentials received
            await this.bot.sendMessage(this.chatId, `
✅ *Credentials Updated!*

🔑 XSRF\\_TOKEN: \`${xsrfToken.substring(0, 20)}...\`
🍪 COOKIE: \`${cookie.substring(0, 30)}...\`

▶️ Script akan melanjutkan...

⏰ *Time:* ${new Date().toLocaleString('id-ID')}
`, {
                parse_mode: 'Markdown'
            });

            return { xsrfToken, cookie };

        } catch (err) {
            console.error('Failed to request new credentials:', err);
            throw err;
        }
    }

    /**
     * Handle XSRF_TOKEN reply
     */
    async handleXSRFTokenReply(token, messageId, pending) {
        // Validate token (basic check)
        if (!token || token.length < 10) {
            await this.bot.sendMessage(this.chatId, '❌ Token tidak valid. Silakan coba lagi dengan reply pesan sebelumnya.', {
                reply_to_message_id: messageId
            });
            return;
        }

        // Edit original message to show received
        try {
            await this.bot.editMessageText(
                `✅ *XSRF\\_TOKEN diterima!*\n\n\`${token.substring(0, 20)}...\``,
                {
                    chat_id: this.chatId,
                    message_id: messageId,
                    parse_mode: 'Markdown'
                }
            );
        } catch (err) {
            // Ignore edit errors
        }

        this.pendingRequests.delete(messageId);
        pending.resolve(token);
    }

    /**
     * Handle COOKIE reply
     */
    async handleCookieReply(cookie, messageId, pending) {
        // Validate cookie (basic check)
        if (!cookie || cookie.length < 20) {
            await this.bot.sendMessage(this.chatId, '❌ Cookie tidak valid. Silakan coba lagi dengan reply pesan sebelumnya.', {
                reply_to_message_id: messageId
            });
            return;
        }

        // Edit original message to show received
        try {
            await this.bot.editMessageText(
                `✅ *COOKIE diterima!*\n\n\`${cookie.substring(0, 30)}...\``,
                {
                    chat_id: this.chatId,
                    message_id: messageId,
                    parse_mode: 'Markdown'
                }
            );
        } catch (err) {
            // Ignore edit errors
        }

        this.pendingRequests.delete(messageId);
        pending.resolve(cookie);
    }

    /**
     * Send completion summary
     */
    async sendCompletionSummary(stats) {
        // Calculate additional stats
        const processedTotal = stats.success + stats.errors;
        const skippedPercent = stats.total > 0 ? ((stats.skipped / stats.total) * 100).toFixed(1) : '0';
        const errorPercent = processedTotal > 0 ? ((stats.errors / processedTotal) * 100).toFixed(1) : '0';
        
        // Determine status emoji based on success rate
        const successRateNum = parseFloat(stats.successRate) || 0;
        let statusEmoji = '🎉';
        if (successRateNum < 50) statusEmoji = '⚠️';
        else if (successRateNum < 80) statusEmoji = '📊';
        else if (successRateNum < 95) statusEmoji = '✅';
        
        const message = `
${statusEmoji} *SCRIPT SELESAI*

📊 *Overview:*
┌─────────────────────────
│ 📦 Total Rows: *${stats.total.toLocaleString('id-ID')}*
│ ✅ Success: *${stats.success.toLocaleString('id-ID')}*
│ ⏭️ Skipped: *${stats.skipped.toLocaleString('id-ID')}* (${skippedPercent}%)
│ ❌ Errors: *${stats.errors.toLocaleString('id-ID')}* (${errorPercent}%)
└─────────────────────────

📈 *Statistics:*
• Processed: ${processedTotal.toLocaleString('id-ID')} rows
• Success Rate: *${stats.successRate}*

⏱️ *Duration:* ${stats.duration}
⏰ *Completed:* ${new Date().toLocaleString('id-ID')}
`;

        try {
            await this.bot.sendMessage(this.chatId, message, {
                parse_mode: 'Markdown'
            });
        } catch (err) {
            console.error('Failed to send completion summary:', err);
        }
    }
}

// Export generateAutoCode for external use
export { generateAutoCode };