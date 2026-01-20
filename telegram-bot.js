/**
 * Telegram Bot Handler untuk konfirmasi kode produk
 */

import TelegramBot from 'node-telegram-bot-api';

export class TelegramProductCodeBot {
    constructor(token, chatId) {
        this.bot = new TelegramBot(token, { polling: true });
        this.chatId = chatId;
        this.pendingRequests = new Map();
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
            
            // Handle seller confirmation
            if (data.startsWith('seller_')) {
                const action = data.replace('seller_', '');
                await this.handleSellerAction(action, query.message.message_id);
            }
            // Handle code confirmation
            else if (data.startsWith('code_')) {
                const [_, action, code] = data.split('_');
                await this.handleCodeConfirmation(action, code, query.message.message_id);
            }
        });
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
     */
    async sendErrorNotification(error, context = '') {
        const message = `
🚨 *Error Detected*

${context ? `📍 *Context:* ${context}\n` : ''}
❌ *Error:* ${error.message || error}

⏰ *Time:* ${new Date().toLocaleString('id-ID')}
`;

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
