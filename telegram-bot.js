/**
 * Telegram Bot Handler untuk konfirmasi kode produk
 */

import TelegramBot from 'node-telegram-bot-api';

export class TelegramProductCodeBot {
    constructor(token, chatId) {
        this.bot = new TelegramBot(token, { polling: false });
        this.chatId = chatId;
        this.pendingRequests = new Map(); // messageId -> { resolve, reject, data }
    }

    /**
     * Request kode produk dari owner via Telegram
     */
    async requestProductCode(productData) {
        const { category, brand, type, product, skuCount } = productData;
        
        const message = `
🔔 *Konfirmasi Kode Produk*

📁 *Kategori:* ${category}
🏷️ *Brand:* ${brand}
📋 *Tipe:* ${type || 'Umum'}
📦 *Produk:* ${product}
🔢 *Jumlah SKU:* ${skuCount} (${skuCount === 3 ? '1 Main 2 Backup' : skuCount === 2 ? '1 Main 1 Backup' : '1 Main 0 Backup'})

Mohon konfirmasi kode produk yang akan digunakan:
`;

        try {
            const sent = await this.bot.sendMessage(this.chatId, message, {
                parse_mode: 'Markdown'
            });

            // Wait for owner reply
            return new Promise((resolve, reject) => {
                this.pendingRequests.set(sent.message_id, {
                    resolve,
                    reject,
                    data: productData,
                    timeout: setTimeout(() => {
                        this.pendingRequests.delete(sent.message_id);
                        reject(new Error('Timeout waiting for product code'));
                    }, 300000) // 5 minutes timeout
                });

                // Listen for reply
                this.bot.once('message', async (msg) => {
                    if (msg.chat.id.toString() === this.chatId.toString() && msg.reply_to_message?.message_id === sent.message_id) {
                        const code = msg.text.trim().toUpperCase();
                        await this.confirmProductCode(code, msg.message_id, productData);
                    }
                });
            });
        } catch (error) {
            throw new Error(`Failed to send Telegram message: ${error.message}`);
        }
    }

    /**
     * Konfirmasi kode produk dengan inline keyboard
     */
    async confirmProductCode(code, replyMessageId, productData) {
        const message = `
✅ *Kode Produk Diterima*

Kode produk yang ditentukan adalah: *${code}*

Apakah sudah benar dan sesuai?
`;

        try {
            const sent = await this.bot.sendMessage(this.chatId, message, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '✅ Ya', callback_data: `confirm_${code}` },
                            { text: '❌ Tidak', callback_data: `reject_${code}` }
                        ]
                    ]
                }
            });

            // Wait for button click
            return new Promise((resolve, reject) => {
                const handler = async (query) => {
                    if (query.message.message_id === sent.message_id) {
                        const [action, receivedCode] = query.data.split('_');
                        
                        await this.bot.answerCallbackQuery(query.id);
                        
                        if (action === 'confirm') {
                            await this.bot.editMessageText(
                                `✅ Kode produk *${receivedCode}* dikonfirmasi!`,
                                {
                                    chat_id: this.chatId,
                                    message_id: sent.message_id,
                                    parse_mode: 'Markdown'
                                }
                            );
                            this.bot.removeListener('callback_query', handler);
                            
                            // Resolve pending request
                            const pending = Array.from(this.pendingRequests.values()).find(p => p.data === productData);
                            if (pending) {
                                clearTimeout(pending.timeout);
                                pending.resolve(receivedCode);
                            }
                            resolve(receivedCode);
                        } else {
                            await this.bot.editMessageText(
                                `❌ Kode produk ditolak. Silakan kirim kode baru.`,
                                {
                                    chat_id: this.chatId,
                                    message_id: sent.message_id
                                }
                            );
                            this.bot.removeListener('callback_query', handler);
                            
                            // Request again
                            const newCode = await this.requestProductCode(productData);
                            resolve(newCode);
                        }
                    }
                };

                this.bot.on('callback_query', handler);
            });
        } catch (error) {
            throw new Error(`Failed to confirm product code: ${error.message}`);
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
