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
     * Send 401 unauthorized notification
     */
    async send401Notification() {
        const message = `
🔐 *Token Kadaluarsa (401 Unauthorized)*

Token Digiflazz sudah tidak valid.

📝 *Action Required:*
1. Buka https://member.digiflazz.com/buyer-area/product
2. Tekan F12 > Network
3. Refresh halaman
4. Copy XSRF_TOKEN dan COOKIE baru
5. Update file .env
6. Restart script

⏰ *Time:* ${new Date().toLocaleString('id-ID')}
`;

        try {
            await this.bot.sendMessage(this.chatId, message, {
                parse_mode: 'Markdown'
            });
        } catch (err) {
            console.error('Failed to send 401 notification:', err);
        }
    }

    /**
     * Send completion summary
     */
    async sendCompletionSummary(stats) {
        const message = `
✅ *Script Selesai*

📊 *Summary:*
• Total: ${stats.total}
• Success: ${stats.success}
• Skipped: ${stats.skipped}
• Errors: ${stats.errors}
• Success Rate: ${stats.successRate}

⏰ *Duration:* ${stats.duration}
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