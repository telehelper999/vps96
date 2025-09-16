let turnstileReady = false;
let currentTurnstileWidget = null;
let userAuthorized = false; // Track authorization status
let currentStakeUsername = null; // Store current username
// Turnstile token pool system (like drop 6.0)
let tokenPool = [];
let maxPoolSize = 5;
let isGeneratingTokens = false;
let tokenMaintenance = null;
// Load saved currency or default to BTC
let selectedCurrency = localStorage.getItem('selectedCurrency') || 'btc';

// Available currencies for selection - Full comprehensive list from NOTCLAIMED.js
const AVAILABLE_CURRENCIES = [
    { value: 'btc', label: 'Bitcoin (BTC)' },
    { value: 'eth', label: 'Ethereum (ETH)' },
    { value: 'ltc', label: 'Litecoin (LTC)' },
    { value: 'doge', label: 'Dogecoin (DOGE)' },
    { value: 'bch', label: 'Bitcoin Cash (BCH)' },
    { value: 'usdt', label: 'Tether (USDT)' },
    { value: 'usdc', label: 'USD Coin (USDC)' },
    { value: 'xrp', label: 'Ripple (XRP)' },
    { value: 'trx', label: 'Tron (TRX)' },
    { value: 'eos', label: 'EOS (EOS)' },
    { value: 'bnb', label: 'Binance Coin (BNB)' },
    { value: 'sol', label: 'Solana (SOL)' },
    { value: 'link', label: 'Chainlink (LINK)' },
    { value: 'uni', label: 'Uniswap (UNI)' },
    { value: 'sand', label: 'The Sandbox (SAND)' },
    { value: 'shib', label: 'Shiba Inu (SHIB)' },
    { value: 'cro', label: 'Crypto.com Coin (CRO)' },
    { value: 'dai', label: 'Dai (DAI)' },
    { value: 'busd', label: 'Binance USD (BUSD)' },
    { value: 'ape', label: 'ApeCoin (APE)' },
    { value: 'pol', label: 'Polygon (POL)' },
    { value: 'trump', label: 'TRUMP Token (TRUMP)' },
    { value: 'usd', label: 'US Dollar (USD)' },
    { value: 'eur', label: 'Euro (EUR)' },
    { value: 'cad', label: 'Canadian Dollar (CAD)' },
    { value: 'jpy', label: 'Japanese Yen (JPY)' },
    { value: 'inr', label: 'Indian Rupee (INR)' },
    { value: 'brl', label: 'Brazilian Real (BRL)' },
    { value: 'try', label: 'Turkish Lira (TRY)' },
    { value: 'sweeps', label: 'Sweepstakes Coins (SWEEPS)' },
    { value: 'gold', label: 'Gold (GOLD)' }
];

(function() {
    'use strict';

    // Enable console output for debugging
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;
    const originalConsoleInfo = console.info;
    const originalConsoleDebug = console.debug;

    // Override window.onerror to suppress errors
    window.onerror = function(message, source, lineno, colno, error) {
        return true; // Suppress error
    };

    // Override unhandledrejection event
    window.addEventListener('unhandledrejection', function(event) {
        event.preventDefault();
        return true;
    });

    // ==================== ENHANCED CONFIGURATION ====================
    const CONFIG = {
        // Your deployed server URL
        API_BASE_URL: 'https://kciade.online',  // ⬅️ Your VPS domain
        BACKEND: {
            CLAIM: '/claim',
            BALANCE: '/balance',
            REDEEM: '/redeem',
            // Enhanced immediate processing endpoints (safe userscript endpoints)
            CONVERT_CURRENCY: '/api/userscript/convert-currency',
            DEDUCT_FEE_IMMEDIATE: '/api/userscript/deduct-fee-immediate',
            UPDATE_CREDITS: '/api/update-credits',
            GET_BALANCE: '/api/balance'
        },
        // Enhanced immediate processing settings
        ENHANCED: {
            IMMEDIATE_FEE_DEDUCTION: true,
            FEE_PERCENTAGE: 5.0, // 5% fee
            MIN_CLAIM_AMOUNT_USD: 0.01, // Minimum $0.01 to process fee
            ATOMIC_TRANSACTIONS: true,
            VERIFY_BEFORE_AND_AFTER: true,
            ROLLBACK_ON_FAILURE: true
        },
        // WS_SECRET removed for security - handled server-side
        // Stake API configuration
        STAKE_API: {
            ENDPOINT: '/_api/graphql',
            VERIFICATION_QUERY: `query BonusCodeInformation($code: String!, $couponType: CouponType!) {\n  bonusCodeInformation(code: $code, couponType: $couponType) {\n    availabilityStatus\n    bonusValue\n    cryptoMultiplier\n  }\n}`,
            CLAIMING_MUTATION: `mutation ClaimConditionBonusCode($code: String!, $currency: CurrencyEnum!, $turnstileToken: String!) {
  claimConditionBonusCode(
    code: $code
    currency: $currency
    turnstileToken: $turnstileToken
  ) {
    bonusCode {
      id
      code
    }
    amount
    currency
    user {
      id
      balances {
        available {
          amount
          currency
        }
      }
    }
  }
}`,
            COUPON_TYPE: 'drop',
            DEFAULT_CURRENCY: 'btc'
        },
        // Turnstile configuration
        TURNSTILE: {
            SITE_KEY: '0x4AAAAAAAGD4gMGOTFnvupz',
            MAX_WAIT_TIME: 5000,  // Match Auto Claim Drop 6.0: 5 seconds
            RETRY_ATTEMPTS: 10    // Match Auto Claim Drop 6.0: 10 retries
        },
        // Enhanced selectors with more fallbacks
        SELECTORS: {
            CODE_INPUT: 'input[name="code"]',
            SUBMIT_BUTTON: 'button[type="submit"]',
            CLAIM_DISMISS_BUTTON: 'button[data-testid="claim-bonus-dismiss"]',
            // Comprehensive fallback selectors
            CODE_INPUT_FALLBACK: [
                'input[name="code"]',
                'input[name="promo"]',
                'input[name="bonus"]',
                'input[name="coupon"]',
                'input[placeholder*="promo" i]',
                'input[placeholder*="code" i]',
                'input[placeholder*="bonus" i]',
                'input[placeholder*="coupon" i]',
                'input[id*="promo" i]',
                'input[id*="code" i]',
                'input[id*="bonus" i]',
                '.promo-input',
                '.bonus-input',
                '.code-input',
                '#promo-code',
                '#bonus-code',
                '#coupon-code'
            ],
            SUBMIT_FALLBACK: [
                'button[type="submit"]',
                'button[data-testid="password-reset-button"]',
                'button:contains("Submit")',
                'button:contains("Check")',
                'button:contains("Apply")',
                'button:contains("Claim")',
                'button:contains("Redeem")',
                'button:contains("Activate")',
                '.submit-btn',
                '.apply-btn',
                '.claim-btn',
                '.redeem-btn',
                'input[type="submit"]'
            ],
            // EXPANDED CLAIM BUTTON SELECTORS
            CLAIM_SELECTORS: [
                'button[data-testid="claim-drop"]',     // SPECIFIC FIX: Target the exact popup button
                'button[data-analytics="claim-drop"]',  // ADDITIONAL FIX: Alternative selector
                'button[data-testid*="claim"]',
                'button:contains("Claim")',
                'button:contains("claim")',
                'button:contains("Claim Bonus")',
                'button:contains("CLAIM")',
                'button:contains("bonus")',
                '.claim-button',
                '.claim-btn',
                '.bonus-claim',
                '.bonus-btn',
                '.bonus-button',
                '.stake-button',
                'button[onclick*="claim"]',
                'a[href*="claim"]',
                '.btn-claim',
                '#claim-btn',
                '#claimButton',
                'button[class*="claim"]',
                'div[role="button"]:contains("Claim")',
                '*[data-action="claim"]',
                'button[data-qa*="bonus"]'
            ],
            // DONE BUTTON SELECTORS (for final step)
            DONE_SELECTORS: [
                'button[data-testid="claim-reward-done"]',    // SPECIFIC FIX: Target the done button
                'button[data-analytics="claim-reward-done"]', // ADDITIONAL FIX: Alternative selector
                'button:contains("Done")',
                'button:contains("DONE")',
                'button:contains("done")',
                'button[data-testid*="done"]',
                '.done-button',
                '.done-btn',
                '#done-btn',
                '#doneButton'
            ],
            MODAL: [
                '.modal',
                '.popup',
                '[role="dialog"]',
                '[role="alertdialog"]',
                '.ReactModal__Content',
                '.bonus-modal',
                '.promo-modal',
                '.claim-modal',
                '.MuiDialog-root',
                '.ant-modal',
                '.chakra-modal'
            ],
            // EXPANDED POPUP SELECTORS
            POPUP_SELECTORS: [
                '.modal',
                '.popup',
                '.overlay',
                '.dialog',
                '.claim-modal',
                '.bonus-popup',
                '[role="dialog"]',
                '.ReactModal__Content',
                '.modal-content',
                '.popup-content'
            ],
            SUCCESS_INDICATORS: [
                '[data-testid*="success"]',
                '[data-testid*="claimed"]',
                '.success-message',
                '.claimed-message',
                '.bonus-claimed',
                '.alert-success'
            ],
            ERROR_INDICATORS: [
                '[data-testid*="error"]',
                '[data-testid*="invalid"]',
                '.error-message',
                '.invalid-message',
                '.alert-error',
                '.alert-danger'
            ]
        },
        // TURBO MODE: Match Auto Claim Drop 6.0 timing
        TIMING: {
            TYPING_DELAY: 0,            // Match Auto Claim Drop 6.0: 0ms delay
            API_CALL_DELAY: 0,          // Match Auto Claim Drop 6.0: immediate processing
            MODAL_WAIT: 100,            // Match Auto Claim Drop 6.0: 100ms scanning
            BUTTON_CLICK_DELAY: 0,      // Match Auto Claim Drop 6.0: instant clicks
            RETRY_DELAY: 75,            // Match Auto Claim Drop 6.0: 50-100ms between retries
            SUCCESS_WAIT: 50,           // Match Auto Claim Drop 6.0: 50-100ms response
            DOM_READY_TIMEOUT: 10000,   // Match Auto Claim Drop 6.0: 10 seconds timeout
            PAGE_LOAD_DELAY: 0          // Match Auto Claim Drop 6.0: no delay
        },
        // SPEED-OPTIMIZED settings
        AUTO_CLAIM_ENABLED: true,
        MAX_RETRIES: 10,        // Match Auto Claim Drop 6.0: 10 retries per code
        DEBUG_MODE: false,      // Disable debug for speed
        USE_API_METHOD: true,   // FORCE API method - do not use UI unless auth fails
        NOTIFICATION_TIMEOUT: 6000,
        // New settings for better reliability
        WAIT_FOR_PAGE_READY: true,
        USE_MUTATION_OBSERVER: true,
        CHECK_URL_CHANGES: true,
        // Polling settings - DISABLED to only get new codes via WebSocket
        POLL_INTERVAL: 10000,  // Check for new codes every 10 seconds
        CONTINUOUS_POLLING: false,  // DISABLED - only use WebSocket for new codes
        USE_WEBSOCKET_ONLY: true    // Only get codes via WebSocket, ignore REST API
    };
    // ==================== ENHANCED HELPER FUNCTIONS ====================
    let debugCount = 0;
    let cachedElements = {
        codeInput: null,
        submitButton: null,
        lastCacheTime: 0
    };
    
    // ==================== ENHANCED IMMEDIATE PROCESSING ====================
    // Global variable to track user credits
    let currentUserCredits = 0;
    
    // ==================== IMMEDIATE CURRENCY CONVERSION ====================
    async function convertToUSDImmediate(amount, fromCurrency) {
        try {
            if (!amount || amount <= 0) {
                throw new Error('Invalid amount for conversion');
            }
            
            // Skip conversion if already USD
            if (fromCurrency.toLowerCase() === 'usd') {
                return { success: true, usd_amount: amount, conversion_rate: 1.0 };
            }
            
            log(`💱 Converting ${amount} ${fromCurrency.toUpperCase()} to USD...`, 'info');
            
            const url = `${CONFIG.API_BASE_URL}${CONFIG.BACKEND.CONVERT_CURRENCY}`;
            const response = await postJSON(url, {
                amount: amount,
                from_currency: fromCurrency.toLowerCase(),
                to_currency: 'usd',
                username: currentStakeUsername
            });
            
            if (response.success && response.usd_amount) {
                log(`💱 Conversion successful: ${amount} ${fromCurrency.toUpperCase()} = $${response.usd_amount} USD`, 'success');
                return {
                    success: true,
                    usd_amount: response.usd_amount,
                    conversion_rate: response.conversion_rate || (response.usd_amount / amount),
                    timestamp: Date.now()
                };
            } else {
                throw new Error(response.error || 'Currency conversion failed');
            }
            
        } catch (error) {
            log(`❌ Currency conversion failed: ${error.message}`, 'error');
            return { success: false, error: error.message };
        }
    }
    
    // ==================== IMMEDIATE FEE DEDUCTION ====================
    async function deductFeeImmediate(code, claimedAmount, claimedCurrency, usdAmount) {
        try {
            if (!usdAmount || usdAmount < CONFIG.ENHANCED.MIN_CLAIM_AMOUNT_USD) {
                log(`⚠️ USD amount too small for fee deduction: $${usdAmount}`, 'warning');
                return { success: true, fee_amount: 0, message: 'Amount too small for fee' };
            }
            
            const feeAmount = (usdAmount * CONFIG.ENHANCED.FEE_PERCENTAGE) / 100;
            
            log(`💰 Deducting immediate fee: $${feeAmount.toFixed(4)} (${CONFIG.ENHANCED.FEE_PERCENTAGE}% of $${usdAmount.toFixed(4)})`, 'info');
            
            const url = `${CONFIG.API_BASE_URL}${CONFIG.BACKEND.DEDUCT_FEE_IMMEDIATE}`;
            const response = await postJSON(url, {
                username: currentStakeUsername,
                code: code,
                claimed_amount: claimedAmount,
                claimed_currency: claimedCurrency.toUpperCase(),
                usd_amount: usdAmount,
                fee_percentage: CONFIG.ENHANCED.FEE_PERCENTAGE,
                fee_amount: feeAmount,
                timestamp: Date.now(),
                atomic: CONFIG.ENHANCED.ATOMIC_TRANSACTIONS
            });
            
            if (response.success) {
                // Update local credits immediately
                currentUserCredits = response.remaining_credits || (currentUserCredits - feeAmount);
                updateCreditsDisplay(currentUserCredits);
                
                log(`✅ Fee deducted successfully! Fee: $${feeAmount.toFixed(4)}, Remaining: $${currentUserCredits.toFixed(2)}`, 'success');
                
                return {
                    success: true,
                    fee_amount: feeAmount,
                    remaining_credits: currentUserCredits,
                    transaction_id: response.transaction_id
                };
            } else {
                throw new Error(response.error || 'Fee deduction failed');
            }
            
        } catch (error) {
            log(`❌ Immediate fee deduction failed: ${error.message}`, 'error');
            
            // If fee deduction fails, we should still report it but flag as failed
            return { 
                success: false, 
                error: error.message,
                requires_manual_review: true 
            };
        }
    }
    
    // ==================== ENHANCED CLAIM PROCESSING ====================
    async function processClaimSuccess(code, stakeResponse) {
        try {
            // Extract claim data from Stake response
            const claimData = stakeResponse.data?.claimConditionBonusCode;
            if (!claimData) {
                throw new Error('Invalid claim response structure');
            }
            
            const claimedAmount = claimData.amount;
            const claimedCurrency = claimData.currency;
            const bonusCodeId = claimData.bonusCode?.id;
            
            log(`🎉 CLAIM SUCCESS: ${claimedAmount} ${claimedCurrency} from code ${code}`, 'success');
            
            // Step 1: Immediate currency conversion
            const conversionResult = await convertToUSDImmediate(claimedAmount, claimedCurrency);
            if (!conversionResult.success) {
                log(`⚠️ Currency conversion failed, using fallback rate`, 'warning');
                // Use a fallback conversion or skip fee if conversion fails
                showNotification(`✅ Claimed ${claimedAmount} ${claimedCurrency} but currency conversion failed`, 'warning');
                return { success: true, fee_processed: false, error: conversionResult.error };
            }
            
            const usdAmount = conversionResult.usd_amount;
            
            // Step 2: Immediate fee deduction
            const feeResult = await deductFeeImmediate(code, claimedAmount, claimedCurrency, usdAmount);
            
            if (feeResult.success) {
                // Success - show detailed notification
                const feeAmount = feeResult.fee_amount;
                const successMessage = `✅ Claimed ${claimedAmount} ${claimedCurrency} ($${usdAmount.toFixed(2)}) - Fee: $${feeAmount.toFixed(2)}`;
                showNotification(successMessage, 'success');
                addActivityLog(`💰 ${successMessage}`, 'claim_success');
                
                return {
                    success: true,
                    fee_processed: true,
                    claimed_amount: claimedAmount,
                    claimed_currency: claimedCurrency,
                    usd_amount: usdAmount,
                    fee_amount: feeAmount,
                    remaining_credits: currentUserCredits
                };
                
            } else {
                // Fee deduction failed - still show claim success but flag for review
                const warningMessage = `⚠️ Claimed ${claimedAmount} ${claimedCurrency} but fee deduction failed`;
                showNotification(warningMessage, 'warning');
                addActivityLog(`⚠️ ${warningMessage} - Requires manual review`, 'claim_warning');
                
                return {
                    success: true,
                    fee_processed: false,
                    error: feeResult.error,
                    requires_manual_review: true,
                    claimed_amount: claimedAmount,
                    claimed_currency: claimedCurrency,
                    usd_amount: usdAmount
                };
            }
            
        } catch (error) {
            log(`❌ Error processing claim success: ${error.message}`, 'error');
            return { success: false, error: error.message };
        }
    }
    
    // ==================== CREDIT VERIFICATION AND PROTECTION ====================
    // ✅ Client-side credit verification removed - now handled server-side for security
    // Server only sends codes to users with sufficient credits (≥ $0.10)
    async function postJSON(url, body) {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': 'client-request' // Authenticated server-side
            },
            body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
    }

    async function getJSON(url) {
        const res = await fetch(url, {
            headers: {
                'X-API-Key': 'client-request' // Authenticated server-side
            }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
    }

    async function reportClaimToBackend({ username, code, value, success }) {
        const url = `${CONFIG.API_BASE_URL}${CONFIG.BACKEND.CLAIM}`;
        try {
            const data = await postJSON(url, { username, code, value, success });
            if (data && typeof data.credits !== 'undefined') {
                updateCreditsDisplay(data.credits);
            }
            return data;
        } catch (e) {
            log(`⚠️ Backend /claim failed: ${e.message}`, 'warning');
            return { success: false, error: e.message };
        }
    }

    async function fetchBalance(username) {
        try {
            const q = new URLSearchParams({ username });
            const url = `${CONFIG.API_BASE_URL}${CONFIG.BACKEND.BALANCE}?${q.toString()}`;
            return await getJSON(url); // { username, credits }
        } catch (e) {
            log(`⚠️ /balance failed: ${e.message}`, 'warning');
            return null;
        }
    }

    async function redeemVoucher(username, voucher_code, amount = null) {
        const url = `${CONFIG.API_BASE_URL}${CONFIG.BACKEND.REDEEM}`;
        try {
            const payload = { username, voucher_code };
            if (amount !== null && amount > 0) {
                payload.amount = amount;
            }
            const data = await postJSON(url, payload);
            if (data && data.ok) {
                const amountText = amount ? `$${amount}` : 'full amount';
                showNotification(`✅ Redeemed ${amountText}. Credits: ${data.credits}. Remaining: ${data.remaining}`, 'success');
                updateCreditsDisplay(data.credits);
            } else {
                showNotification(`❌ Redeem failed`, 'error');
            }
            return data;
        } catch (e) {
            showNotification(`❌ Redeem error: ${e.message}`, 'error');
            return null;
        }
    }

    async function fetchVoucherInfo(voucher_code) {
        try {
            const url = `${CONFIG.API_BASE_URL}/voucher-info?voucher_code=${encodeURIComponent(voucher_code)}`;
            const data = await getJSON(url);
            return data;
        } catch (e) {
            return null;
        }
    }

    function refreshElementCache() {
        const now = Date.now();
        if (now - cachedElements.lastCacheTime < 5000) return; // Cache for 5 seconds
        cachedElements.codeInput = findElement(CONFIG.SELECTORS.CODE_INPUT_FALLBACK);
        cachedElements.submitButton = findElement(CONFIG.SELECTORS.SUBMIT_FALLBACK);
        cachedElements.lastCacheTime = now;
        if (cachedElements.codeInput && cachedElements.submitButton) {
            log('⚡ Elements pre-cached for ultra-fast access', 'debug');
        }
    }
    // Enhanced retry helper: keep searching until found with better error handling
    function waitAndClick(selectorList, root = document, maxTries = 50) {
        return new Promise((resolve) => {
            let tries = 0;
            const interval = setInterval(() => {
                // Use queryContains for text-based searching
                const claimButtons = queryContains('button', 'claim', root);
                const bonusButtons = queryContains('button', 'bonus', root);
                const allButtons = [...claimButtons, ...bonusButtons];
                for (const el of allButtons) {
                    try {
                        el.click();
                        log(`✅ Clicked button (text-based): "${el.textContent.trim()}"`, 'success');
                        clearInterval(interval);
                        resolve(true);
                        return;
                    } catch (e) {
                        log(`❌ Failed to click button: ${e.message}`, 'error');
                    }
                }
                // Use enhanced selector processing for :contains support
                const allElements = querySelectorAllEnhanced(selectorList, root);
                for (const el of allElements) {
                    try {
                        el.click();
                        log(`✅ Clicked button (enhanced): "${el.textContent.trim()}"`, 'success');
                        clearInterval(interval);
                        resolve(true);
                        return;
                    } catch (e) {
                        log(`❌ Failed to click button: ${e.message}`, 'error');
                    }
                }
                if (++tries >= maxTries) {
                    clearInterval(interval);
                    log("⚠️ No claim button found after retries", "warning");
                    resolve(false);
                }
            }, 100); // check every 100ms
        });
    }
    function log(message, type = 'info', data = null) {
        const timestamp = new Date().toLocaleTimeString();
        const count = ++debugCount;

        // Only show code-related messages in console
        if (type === 'success' && message.includes('CLAIMED')) {
            originalConsoleLog(`✅ ${message}`);
        } else if (type === 'error' && (message.includes('failed') || message.includes('Error') || message.includes('not claimed'))) {
            originalConsoleLog(`❌ ${message}`);
        } else if (type === 'warning' && (message.includes('Not available') || message.includes('Not claimed') || message.includes('inactive') || message.includes('limit reached'))) {
            originalConsoleLog(`⚠️ ${message}`);
        } else if (type === 'info' && (message.includes('Listening') || message.includes('Connected'))) {
            originalConsoleLog(`📡 Listening to codes...`);
        } else if (type === 'warning' && message.includes('Disconnected')) {
            originalConsoleLog(`🔌 Disconnected`);
        }

        // Store logs for debugging
        if (!window.autoClaimerLogs) window.autoClaimerLogs = [];
        window.autoClaimerLogs.push({
            timestamp,
            count,
            type,
            message,
            data,
            url: window.location.href
        });
    }
    function showNotification(message, type = 'info') {
        // Remove existing notification
        const existing = document.getElementById('autoclaimer-notification');
        if (existing) existing.remove();
        const notification = document.createElement('div');
        notification.id = 'autoclaimer-notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 999999;
            background: linear-gradient(135deg, #1a1a2e, #16213e);
            color: white;
            padding: 15px 20px;
            border-radius: 10px;
            border-left: 4px solid #007bff;
            max-width: 350px;
            font-size: 14px;
            font-family: 'Segoe UI', Arial, sans-serif;
            box-shadow: 0 8px 16px rgba(0,0,0,0.4);
            transition: all 0.3s ease;
            backdrop-filter: blur(10px);
            word-wrap: break-word;
        `;
        const colors = {
            'error': '#dc3545',
            'success': '#28a745',
            'warning': '#ffc107',
            'info': '#007bff',
            'debug': '#6f42c1'
        };
        notification.style.borderLeftColor = colors[type] || colors.info;
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => {
            if (notification && notification.parentNode) {
                notification.style.opacity = '0';
                notification.style.transform = 'translateX(100%)';
                setTimeout(() => notification.remove(), 300);
            }
        }, CONFIG.NOTIFICATION_TIMEOUT);
    }
    function waitForElement(selector, timeout = CONFIG.TIMING.DOM_READY_TIMEOUT, root = document) {
        return new Promise((resolve) => {
            const startTime = Date.now();
            function check() {
                const element = findElement(selector, root);
                if (element) {
                    log(`✅ Element found: ${selector}`, 'debug');
                    resolve(element);
                    return;
                }
                if (Date.now() - startTime >= timeout) {
                    log(`⏰ Timeout waiting for element: ${selector}`, 'warning');
                    resolve(null);
                    return;
                }
                setTimeout(check, 100);
            }
            check();
        });
    }
    // Enhanced helper function to replace :contains selector with better nested text handling
    function queryContains(baseSelector, text, root = document) {
        return Array.from(root.querySelectorAll(baseSelector))
                    .filter(el => {
                        // Check both textContent and innerText for better nested content handling
                        const textContent = (el.textContent || '').toLowerCase();
                        const innerText = (el.innerText || '').toLowerCase();
                        const searchText = text.toLowerCase();
                        return (textContent.includes(searchText) || innerText.includes(searchText)) && isVisible(el);
                    });
    }
    // Process selectors including :contains pseudo-selectors
    function querySelectorAllEnhanced(selectorList, root = document) {
        const results = [];
        for (const selector of selectorList) {
            try {
                if (selector.includes(':contains(')) {
                    // Parse :contains selector
                    const match = selector.match(/^([^:]+):contains\("([^"]+)"\)$/);
                    if (match) {
                        const [, baseSelector, text] = match;
                        const elements = queryContains(baseSelector, text, root);
                        results.push(...elements);
                    }
                } else {
                    // Regular selector
                    const elements = root.querySelectorAll(selector);
                    results.push(...Array.from(elements).filter(el => isVisible(el)));
                }
            } catch (e) {
                // Skip invalid selectors
                continue;
            }
        }
        // Remove duplicates
        return [...new Set(results)];
    }
    function findElement(selector, root = document) {
        try {
            if (Array.isArray(selector)) {
                for (const sel of selector) {
                    const element = findElement(sel, root);
                    if (element) {
                        log(`🎯 Found element with selector: ${sel}`, 'debug');
                        return element;
                    }
                }
                // Try text-based search for submit buttons
                const submitTexts = ['Submit', 'Check', 'Apply', 'Claim', 'Redeem', 'Activate'];
                for (const text of submitTexts) {
                    const elements = queryContains('button', text, root);
                    if (elements.length > 0) {
                        log(`🎯 Found button with text: ${text}`, 'debug');
                        return elements[0];
                    }
                }
                // Try text-based search for claim buttons
                const claimTexts = ['Claim', 'claim', 'Claim Bonus', 'CLAIM', 'bonus'];
                for (const text of claimTexts) {
                    const elements = queryContains('button, div[role="button"]', text, root);
                    if (elements.length > 0) {
                        log(`🎯 Found claim element with text: ${text}`, 'debug');
                        return elements[0];
                    }
                }
                return null;
            }
            const element = root.querySelector(selector);
            if (element && isVisible(element)) {
                return element;
            }
        } catch (e) {
            log(`❌ Selector error: ${selector} - ${e.message}`, 'error');
        }
        return null;
    }
    function isVisible(element) {
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return style.display !== 'none' &&
               style.visibility !== 'hidden' &&
               style.opacity !== '0' &&
               rect.width > 0 &&
               rect.height > 0 &&
               rect.top >= 0 &&
               rect.left >= 0;
    }
    function isOnOffersPage() {
        const url = window.location.href.toLowerCase();
        return url.includes('/settings/offers') ||
               url.includes('/offers') ||
               url.includes('/promotions') ||
               url.includes('/bonus') ||
               url.includes('/promo');
    }
    // ==================== TURNSTILE FUNCTIONS ====================
    function loadTurnstileScript() {
        if (document.getElementById('turnstile-script')) {
            return; // Already loaded
        }
        const script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileReady';
        script.type = 'text/javascript';
        script.defer = true;
        script.id = 'turnstile-script';
        document.head.appendChild(script);
        log('🔐 Loading Turnstile MOJ script...', 'info');
    }
    window.onTurnstileReady = function() {
        turnstileReady = true;
        log('🔐 Turnstile MOJ loaded successfully', 'success');
        // Start token pool maintenance immediately
        startTokenMaintenance();
    };
    async function solveTurnstileActual() {
        if (!turnstileReady) {
            log('⏳ Waiting for Turnstile MOJ to load...', 'warning');
            // Quick retry if not ready
            await new Promise(resolve => setTimeout(resolve, 100));
            if (!turnstileReady) return null;
        }
        try {
            const container = document.createElement('div');
            container.style.cssText = 'position: fixed; top: -1000px; left: -1000px; z-index: -1; width: 1px; height: 1px;';
            document.body.appendChild(container);
            return new Promise((resolve, reject) => {
                const startTime = Date.now();
                const widgetId = window.turnstile.render(container, {
                    sitekey: CONFIG.TURNSTILE.SITE_KEY,
                    theme: 'light',  // Light theme can be faster
                    size: 'compact', // Compact size for speed
                    callback: function(token) {
                        const solveTime = Date.now() - startTime;
                        log(`⚡ Turnstile solved in ${solveTime}ms`, 'success');
                        container.remove();
                        resolve(token);
                    },
                    'error-callback': function() {
                        log('❌ Turnstile failed', 'error');
                        container.remove();
                        reject(new Error('Turnstile failed'));
                    },
                    'timeout-callback': function() {
                        log('⏰ Turnstile timeout', 'warning');
                        container.remove();
                        reject(new Error('Turnstile timeout'));
                    }
                });
                // Faster timeout
                setTimeout(() => {
                    if (container.parentNode) {
                        container.remove();
                        reject(new Error('Turnstile timeout'));
                    }
                }, CONFIG.TURNSTILE.MAX_WAIT_TIME);
            });
        } catch (error) {
            log(`❌ Turnstile error: ${error.message}`, 'error');
            return null;
        }
    }

    // Token pool management system (like drop 6.0)
    async function createToken() {
        if (!turnstileReady) return null;

        try {
            const token = await solveTurnstileActual();
            if (token) {
                return {
                    token: token,
                    timestamp: Date.now(),
                    used: false
                };
            }
        } catch (error) {
            log(`❌ Token creation failed: ${error.message}`, 'error');
        }
        return null;
    }

    async function getToken() {
        // Remove expired tokens first
        cleanExpiredTokens();

        // Find an unused token
        for (let i = 0; i < tokenPool.length; i++) {
            if (!tokenPool[i].used) {
                tokenPool[i].used = true;
                log(`⚡ Using token from pool (${tokenPool.length - 1} remaining)`, 'info');
                return tokenPool[i].token;
            }
        }

        // No unused tokens available, generate fresh one
        log('🔄 Pool empty, generating fresh token...', 'info');
        const tokenObj = await createToken();
        if (tokenObj) {
            tokenObj.used = true;
            return tokenObj.token;
        }

        return null;
    }

    function cleanExpiredTokens() {
        const now = Date.now();
        const expireTime = 4 * 60 * 1000; // 4 minutes

        const originalLength = tokenPool.length;
        tokenPool = tokenPool.filter(tokenObj => {
            const age = now - tokenObj.timestamp;
            return age < expireTime;
        });

        if (originalLength !== tokenPool.length) {
            log(`🧹 Cleaned ${originalLength - tokenPool.length} expired tokens`, 'debug');
        }
    }

    async function maintainTokens() {
        if (!turnstileReady || isGeneratingTokens) return;

        cleanExpiredTokens();

        // Count available (unused) tokens
        const availableTokens = tokenPool.filter(t => !t.used).length;
        const tokensNeeded = maxPoolSize - availableTokens;

        if (tokensNeeded > 0) {
            isGeneratingTokens = true;
            log(`🔧 Generating ${tokensNeeded} fresh tokens for pool...`, 'info');

            for (let i = 0; i < tokensNeeded; i++) {
                try {
                    const tokenObj = await createToken();
                    if (tokenObj) {
                        tokenPool.push(tokenObj);
                        log(`✅ Token ${i + 1}/${tokensNeeded} added to pool`, 'debug');
                    }
                } catch (error) {
                    log(`❌ Failed to generate token ${i + 1}: ${error.message}`, 'error');
                    break;
                }
            }
            isGeneratingTokens = false;
            log(`🎯 Token pool maintained: ${tokenPool.length} total, ${tokenPool.filter(t => !t.used).length} available`, 'success');
        }
    }

    function startTokenMaintenance() {
        if (tokenMaintenance) return;

        // Initial pool fill
        setTimeout(async () => {
            log('🚀 Starting token pool maintenance...', 'info');
            await maintainTokens();
        }, 1000);

        // Maintain pool every 30 seconds
        tokenMaintenance = setInterval(async () => {
            await maintainTokens();
        }, 30000);
    }

    function stopTokenMaintenance() {
        if (tokenMaintenance) {
            clearInterval(tokenMaintenance);
            tokenMaintenance = null;
            log('⏹️ Token maintenance stopped', 'info');
        }
    }

    // Legacy function name for compatibility - now uses token pool
    async function solveTurnstile() {
        return await getToken();
    }
    // ==================== ENHANCED API FUNCTIONS ====================
    async function claimBonusCodeWithAPI(code) {
        try {
            log(`🎯 Attempting to claim code with MOJ: ${code}`, 'info');
            // Get cached Turnstile token (instant if cached)
            log(`⚡ Getting Turnstile token from cache...`, 'info');
            const turnstileToken = await solveTurnstile();
            if (!turnstileToken) {
                throw new Error('Failed to obtain Turnstile token');
            }
            log(`✅ Turnstile token obtained: ${turnstileToken.substring(0, 20)}...`, 'success');
            const stakeApiUrl = `${window.location.origin}${CONFIG.STAKE_API.ENDPOINT}`;
            // Extract session token from cookies for authentication
            const sessionMatch = document.cookie.match(/session=([^;]+)/);
            const sessionToken = sessionMatch ? sessionMatch[1] : null;
            if (!sessionToken) {
                throw new Error('No session token found - please log in to Stake');
            }
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 45000); // 45s timeout for claim requests with Turnstile

            const response = await fetch(stakeApiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': '*/*',
                    'User-Agent': navigator.userAgent,
                    'x-access-token': sessionToken,
                    'x-language': 'en',
                    'x-operation-name': 'ClaimConditionBonusCode',
                    'x-operation-type': 'query',
                    'cache-control': 'no-cache',
                    'pragma': 'no-cache',
                    'sec-fetch-dest': 'empty',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-site': 'same-origin'
                },
                credentials: 'include',
                signal: controller.signal,
                body: JSON.stringify({
                    operationName: "ClaimConditionBonusCode",
                    query: CONFIG.STAKE_API.CLAIMING_MUTATION,
                    variables: {
                        code: code.trim(),
                        currency: selectedCurrency.toLowerCase(), // Use lowercase as per real API logs
                        turnstileToken: turnstileToken
                    }
                })
            });

            clearTimeout(timeoutId);
            log(`📡 Claim MOJ Response Status: ${response.status}`, 'debug');
            if (!response.ok) {
                const errorText = await response.text();
                log(`❌ HTTP Error Response: ${errorText}`, 'error');
                throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
            }
            const result = await response.json();
            log(`📄 Claim MOJ Response:`, 'debug', result);
            // Handle error responses
            if (result.errors && result.errors.length > 0) {
                const error = result.errors[0];
                const errorMsg = error.message;
                const errorType = error.errorType;
                log(`❌ Claim MOJ Error (${errorType}): ${errorMsg}`, 'error');
                showNotification(`❌ Claim failed: ${errorMsg}`, 'error');
                addActivityLog(`Failed: ${code} - ${errorMsg}`, 'error');
                // ⬇️ Inform backend about failed attempt (no deduction)
                const uname = user || (window.lastKnownStakeUsername || 'unknown');
                reportClaimToBackend({ username: uname, code, value: 0, success: false }).catch(()=>{});
                return { success: false, error: errorMsg, errorType: errorType };
            }
            // Handle successful claim
            const claimResult = result.data?.claimConditionBonusCode;
            if (claimResult) {
                const amount = claimResult.amount;
                const currency = claimResult.currency;
                const bonusCode = claimResult.bonusCode;
                const user = claimResult.user;
                log(`🎉 BONUS CLAIMED SUCCESSFULLY: ${code}`, 'success');
                log(`💰 Amount: ${amount} ${currency}`, 'success');
                log(`🎫 Bonus Code ID: ${bonusCode?.id}`, 'success');
                const successMessage = `🎉 Claimed ${amount} ${currency.toUpperCase()} from code: ${code}`;
                showNotification(successMessage, 'success');
                addActivityLog(successMessage, 'claim');
                // ⬇️ Report success to backend (server will deduct 4%)
                try {
                    const uname = user || (window.lastKnownStakeUsername || 'unknown');
                    await reportClaimToBackend({
                        username: uname,
                        code: bonusCode || code,
                        value: amount,
                        success: true
                    });
                } catch (e) {
                    log(`⚠️ Could not report claim to backend: ${e.message}`, 'warning');
                }
                return {
                    success: true,
                    claimed: true,
                    amount: amount,
                    currency: currency,
                    bonusCode: bonusCode,
                    user: user
                };
            }
            return { success: false, error: 'No claim result returned' };
        } catch (error) {
            log(`❌ Claim MOJ call failed for ${code}: ${error.message}`, 'error');
            return { success: false, error: error.message };
        }
    }
    async function verifyCodeWithAPI(code) {
        try {
            log(`🔍 Verifying code with MOJ: ${code}`, 'info');
            addActivityLog(`🔍 Verifying code with MOJ: ${code}`, 'code_verification');
            const stakeApiUrl = `${window.location.origin}${CONFIG.STAKE_API.ENDPOINT}`;
            // Extract session token from cookies for authentication
            const sessionMatch = document.cookie.match(/session=([^;]+)/);
            const sessionToken = sessionMatch ? sessionMatch[1] : null;
            if (!sessionToken) {
                throw new Error('No session token found - please log in to Stake');
            }
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout for verification requests
            const response = await fetch(stakeApiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': '*/*',
                    'User-Agent': navigator.userAgent,
                    'x-access-token': sessionToken,
                    'x-language': 'en',
                    'x-operation-name': 'BonusCodeInformation',
                    'cache-control': 'no-cache',
                    'pragma': 'no-cache',
                    'sec-fetch-dest': 'empty',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-site': 'same-origin'
                },
                credentials: 'include',
                signal: controller.signal,
                body: JSON.stringify({
                    query: CONFIG.STAKE_API.VERIFICATION_QUERY,
                    variables: {
                        code: code.trim(),
                        couponType: CONFIG.STAKE_API.COUPON_TYPE
                    }
                })
            });
            clearTimeout(timeoutId);
            log(`📡 MOJ Response Status: ${response.status}`, 'debug');
            if (!response.ok) {
                const errorText = await response.text();
                log(`❌ HTTP Error Response: ${errorText}`, 'error');
                throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
            }
            const result = await response.json();
            log(`📄 MOJ Response:`, 'debug', result);
            // Handle error responses
            if (result.errors && result.errors.length > 0) {
                const error = result.errors[0];
                const errorMsg = error.message;
                const errorType = error.errorType;
                log(`❌ MOJ Error (${errorType}): ${errorMsg}`, 'error');
                if (errorType === 'notFound') {
                    showNotification(`❌ Code not found: ${code}`, 'error');
                    addActivityLog(`❌ Code not found: ${code}`, 'error');
                } else {
                    showNotification(`❌ Error: ${errorMsg}`, 'error');
                    addActivityLog(`❌ MOJ Error: ${errorMsg}`, 'error');
                }
                return { success: false, error: errorMsg, errorType: errorType };
            }
            // Handle successful responses
            const bonusInfo = result.data?.bonusCodeInformation;
            if (bonusInfo) {
                const status = bonusInfo.availabilityStatus;
                const bonusValue = bonusInfo.bonusValue;
                const cryptoMultiplier = bonusInfo.cryptoMultiplier;
                const isAvailable = status === 'AVAILABLE' || status === 'available';
                let statusMessage = '';
                let popupType = '';
                if (isAvailable) {
                    statusMessage = `✅ Code available: ${code}`;
                    if (bonusValue) {
                        statusMessage += ` (Value: ${bonusValue})`;
                    }
                    popupType = 'success';
                } else if (status === 'bonusCodeInactive') {
                    statusMessage = `Inactive: ${code}`;
                    popupType = 'warning';
                } else if (status === 'alreadyClaimed') {
                    statusMessage = `ℹ️ Already claimed: ${code}`;
                    popupType = 'info';
                } else {
                    statusMessage = `⚠️ Code unavailable: ${code} (${status})`;
                    popupType = 'warning';
                }
                log(`🎯 Code verified: ${code} - Status: ${status} - Available: ${isAvailable}`,
                    isAvailable ? 'success' : 'warning');
                showNotification(statusMessage, popupType);
                addActivityLog(statusMessage, isAvailable ? 'claim' : 'dismiss');
                return {
                    success: true,
                    data: bonusInfo,
                    available: isAvailable,
                    status: status,
                    bonusValue: bonusValue,
                    cryptoMultiplier: cryptoMultiplier
                };
            }
            return { success: false, error: 'No bonus information returned' };
        } catch (error) {
            log(`❌ MOJ call failed for ${code}: ${error.message}`, 'error');
            return { success: false, error: error.message };
        }
    }
    // Filter function to remove test codes
    function isValidStakeCode(code) {
        if (!code || typeof code !== 'string') {
            return false;
        }
        const trimmedCode = code.trim();
        const testCodes = ['CLAIM', 'LIMIT', 'USERS', 'TEST', 'EXAMPLE', 'TESTDEBUG2020']; // Corrected version
        if (testCodes.includes(trimmedCode.toUpperCase())) {
            log(`🚫 Filtered out test code: ${trimmedCode}`, 'warning');
            return false;
        }
        if (/^[0-9]+$/.test(trimmedCode) && trimmedCode.length > 8) {
            log(`🚫 Filtered out test number pattern: ${trimmedCode}`, 'warning');
            return false;
        }
        if (trimmedCode.length < 3 || trimmedCode.length > 20) {
            log(`🚫 Filtered out invalid length code: ${trimmedCode}`, 'warning');
            return false;
        }
        if (!/^[A-Za-z0-9]+$/.test(trimmedCode)) {
            log(`🚫 Filtered out invalid characters in code: ${trimmedCode}`, 'warning');
            return false;
        }
        return true;
    }

    // Function to parse value from code data
    function parseCodeValue(codeData) {
        // If codeData is a string (just the code), no value info
        if (typeof codeData === 'string') {
            return null;
        }

        // If it's an object, look for value information
        if (codeData && typeof codeData === 'object') {
            // Check for various value fields
            const value = codeData.value || codeData.amount || codeData.bonus || codeData.worth || null;

            if (value) {
                // Extract numeric value from strings like "$2", "2$", "2 USD", etc.
                const numericValue = parseFloat(value.toString().replace(/[^\d.]/g, ''));
                return isNaN(numericValue) ? null : numericValue;
            }
        }

        return null;
    }

    // Function to check if code should be claimed based on value filters
    function shouldClaimCode(code, value) {
        try {
            // Get saved value filters
            const savedValueFilters = localStorage.getItem('selectedValueFilters');
            let valueFilters = {};

            if (savedValueFilters) {
                try {
                    valueFilters = JSON.parse(savedValueFilters);
                } catch (error) {
                    log('Error parsing saved value filters, claiming all codes', 'warning');
                    return true; // If can't parse filters, claim everything
                }
            }

            // Check if any filters are active
            const hasActiveFilters = Object.values(valueFilters).some(checked => checked === true);

            // If no filters are active, claim all codes
            if (!hasActiveFilters) {
                log(`✅ No value filters active, claiming code: ${code}`, 'info');
                return true;
            }

            // If no value provided with code, claim it automatically
            if (value === null || value === undefined) {
                log(`✅ No value provided with code, claiming: ${code}`, 'info');
                addActivityLog(`✅ Auto-claiming ${code} (no value specified)`, 'info');
                return true;
            }

            // Check specific value filters
            if (valueFilters['1'] && value === 1) {
                log(`✅ $1 filter matched for code: ${code}`, 'success');
                addActivityLog(`✅ $1 filter matched: ${code}`, 'info');
                return true;
            }

            if (valueFilters['2'] && value === 2) {
                log(`✅ $2 filter matched for code: ${code}`, 'success');
                addActivityLog(`✅ $2 filter matched: ${code}`, 'info');
                return true;
            }

            if (valueFilters['3'] && value === 3) {
                log(`✅ $3 filter matched for code: ${code}`, 'success');
                addActivityLog(`✅ $3 filter matched: ${code}`, 'info');
                return true;
            }

            if (valueFilters['4'] && value === 4) {
                log(`✅ $4 filter matched for code: ${code}`, 'success');
                addActivityLog(`✅ $4 filter matched: ${code}`, 'info');
                return true;
            }

            if (valueFilters['5'] && value === 5) {
                log(`✅ $5 filter matched for code: ${code}`, 'success');
                addActivityLog(`✅ $5 filter matched: ${code}`, 'info');
                return true;
            }

            if (valueFilters['6.25'] && value === 6.25) {
                log(`✅ $6.25 filter matched for code: ${code}`, 'success');
                addActivityLog(`✅ $6.25 filter matched: ${code}`, 'info');
                return true;
            }

            if (valueFilters['12.50'] && value === 12.50) {
                log(`✅ $12.50 filter matched for code: ${code}`, 'success');
                addActivityLog(`✅ $12.50 filter matched: ${code}`, 'info');
                return true;
            }

            if (valueFilters['25'] && value === 25) {
                log(`✅ $25 filter matched for code: ${code}`, 'success');
                addActivityLog(`✅ $25 filter matched: ${code}`, 'info');
                return true;
            }

            if (valueFilters['50'] && value === 50) {
                log(`✅ $50 filter matched for code: ${code}`, 'success');
                addActivityLog(`✅ $50 filter matched: ${code}`, 'info');
                return true;
            }

            if (valueFilters['high'] && value > 50) {
                log(`✅ High Rollers filter matched for code: ${code} (Value: $${value})`, 'success');
                addActivityLog(`✅ High Rollers matched: ${code} ($${value})`, 'info');
                return true;
            }

            if (valueFilters['all']) {
                log(`✅ ALL (Streamers) filter active, claiming code: ${code}${value ? ` (Value: $${value})` : ''}`, 'success');
                addActivityLog(`✅ ALL filter matched: ${code}${value ? ` ($${value})` : ''}`, 'info');
                return true;
            }

            // If we reach here, no filters matched
            log(`⚠️ Value $${value} not matched with checked filters for code: ${code}`, 'warning');
            addActivityLog(`⚠️ Value not matched: ${code} ($${value})`, 'dismiss');
            return false;

        } catch (error) {
            log(`❌ Error checking value filters for ${code}: ${error.message}`, 'error');
            return true; // If error, claim the code anyway
        }
    }
    async function fetchCodesFromServer() {
        try {
            log(`📡 Fetching codes from server: ${CONFIG.API_BASE_URL}/MOJ/codes`, 'info');
            const response = await fetch(`${CONFIG.API_BASE_URL}/api/codes`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': navigator.userAgent
                },
                mode: 'cors'
            });
            log(`📡 Server response status: ${response.status}`, 'debug');
            if (!response.ok) {
                throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            log(`📦 Raw server response:`, 'debug', data);
            let allCodes = [];
            if (data && data.codes && Array.isArray(data.codes)) {
                allCodes = data.codes.map(c => c.toString().toUpperCase());
            } else if (data && data.code) {
                allCodes = [data.code.toString().toUpperCase()];
            } else if (Array.isArray(data)) {
                allCodes = data.map(c => c.toString().toUpperCase());
            } else {
                log(`📋 No codes available from server - Response: ${JSON.stringify(data)}`, 'warning');
                return [];
            }
            const validCodes = allCodes.filter(isValidStakeCode);
            const filteredCount = allCodes.length - validCodes.length;
            if (filteredCount > 0) {
                log(`🔄 Filtered out ${filteredCount} test/invalid codes`, 'info');
            }

            // Apply value filtering if data contains value information
            const codesWithValues = [];
            if (data && data.codes && Array.isArray(data.codes)) {
                for (const codeData of data.codes) {
                    const code = typeof codeData === 'string' ? codeData : codeData.code || codeData.toString();
                    const value = parseCodeValue(codeData);

                    if (isValidStakeCode(code) && shouldClaimCode(code, value)) {
                        codesWithValues.push({ code: code.toUpperCase(), value: value });
                    }
                }
            } else {
                // Fallback for simple string arrays
                for (const code of validCodes) {
                    if (shouldClaimCode(code, null)) {
                        codesWithValues.push({ code: code, value: null });
                    }
                }
            }

            log(`📦 Received ${codesWithValues.length} codes that passed value filters`, 'success');
            return codesWithValues;
        } catch (error) {
            log(`❌ Failed to fetch codes from server: ${error.message}`, 'error');
            log(`🔧 Check if ${CONFIG.API_BASE_URL}/MOJ/codes is accessible`, 'info');
            return [];
        }
    }
    // Global variables to track current code being processed
    let currentProcessingCode = '';
    let pollingInterval = null;
    let lastProcessedCodeTimestamp = 0;
    let websocketConnection = null;
    let reconnectDelay = 2000; // Match Auto Claim Drop 6.0: Start with 2000ms reconnect delay
    // ==================== SOCKET.IO CONNECTION WITH SECURITY ====================
    function connectWebSocket() {
        // Protect against multiple sockets being opened
        if (websocketConnection && websocketConnection.connected) {
            try { websocketConnection.disconnect(); } catch (e) {}
        }
        try {
            const base = CONFIG.API_BASE_URL;
            const uname = window.lastKnownStakeUsername || 'anonymous';

            log(`🔌 Connecting to Socket.IO server: ${base}`, 'info');

            // Load Socket.IO client if not available
            if (typeof io === 'undefined') {
                const script = document.createElement('script');
                script.src = 'https://cdn.socket.io/4.7.2/socket.io.min.js';
                script.onload = () => initSocketIO();
                document.head.appendChild(script);
                return;
            }

            initSocketIO();

            function initSocketIO() {
                websocketConnection = io(base, {
                    query: {
                        userId: uname,
                        token: 'RlsCl49GO5RWwVSkYcN'  // Server validates this securely
                    },
                    transports: ['websocket'],  // FORCE WEBSOCKET ONLY - NO POLLING FALLBACK
                    upgrade: false,  // DISABLE TRANSPORT UPGRADES
                    timeout: 20000,
                    reconnection: true,
                    reconnectionDelay: 2000,
                    reconnectionDelayMax: 10000,
                    maxReconnectionAttempts: 10
                });

                websocketConnection.on('connect', function() {
                    const transport = websocketConnection.io.engine.transport.name;
                    log(`📡 Socket.IO connected via ${transport.toUpperCase()} - Listening to codes...`, 'success');
                    console.log('🔌 Transport used:', transport);  // Debug transport type
                    addActivityLog(`Connected (${transport})`, 'system');
                    updateConnectionStatus(true, 'User connected successfully');
                    reconnectDelay = 2000;
                });

                // Listen for bonus_code events (from your backend)
                websocketConnection.on('bonus_code', function(data) {
                    if (data.code) {
                        const code = data.code;
                        const value = data.value || parseCodeValue(data);
                        const timeDiff = Date.now() - (data.broadcast_time || Date.now());

                        if (isValidStakeCode(code)) {
                            log(`🆕 NEW CODE received via Socket.IO: ${code}${value ? ` (Value: $${value})` : ''} (${timeDiff}ms latency)`, 'success');
                            addActivityLog(`Code received: ${code}${value ? ` ($${value})` : ''}`, 'code_received');

                            // Check if code should be claimed based on value filters
                            if (shouldClaimCode(code, value)) {
                                // INSTANT processing with no delay
                                setTimeout(() => processSingleCode(code, value), 0);
                            } else {
                                log(`🚫 Code filtered out by value filters: ${code} ($${value})`, 'warning');
                                addActivityLog(`🚫 Filtered: ${code} ($${value}) - Value not matched`, 'dismiss');
                            }
                        } else {
                            log(`🚫 Invalid code filtered: ${code}`, 'warning');
                        }
                    }
                });

                // Handle welcome/connected messages
                websocketConnection.on('welcome', function(data) {
                    log('🎉 Server welcome message received', 'success');
                    updateConnectionStatus(true, 'Connected - Monitoring for new codes');
                });

                websocketConnection.on('disconnect', function(reason) {
                    log(`🔌 Socket.IO disconnected: ${reason}`, 'warning');
                    addActivityLog('Reconnecting', 'system');
                    updateConnectionStatus(false, 'Disconnected - Reconnecting...');
                });

                websocketConnection.on('connect_error', function(error) {
                    log(`❌ Socket.IO connection error: ${error.message}`, 'error');
                    updateConnectionStatus(false, 'Connection Error - Please check your connection or token');
                });

                websocketConnection.on('reconnect', function(attemptNumber) {
                    log(`🔄 Socket.IO reconnected after ${attemptNumber} attempts`, 'success');
                    updateConnectionStatus(true, 'Reconnected successfully');
                });

                // Handle authentication errors (WS_SECRET validation)
                websocketConnection.on('auth_error', function(data) {
                    log(`🚫 Authentication failed: ${data.message}`, 'error');
                    updateConnectionStatus(false, 'Authentication Failed - Check server config');
                });
            }

        } catch (error) {
            log(`❌ Socket.IO connection failed: ${error.message}`, 'error');
            updateConnectionStatus(false, 'Connection Failed - Please contact support or buy a subscription');
            addActivityLog('❌ Failed to connect server', 'error');
        }
    }
    function disconnectWebSocket() {
        if (websocketConnection) {
            websocketConnection.disconnect();
            websocketConnection = null;
            log('🔌 Socket.IO disconnected', 'info');
            addActivityLog('Disconnected', 'system');
            updateConnectionStatus(false, 'Disconnected - Please check your subscription');
        }
    }
    // Ultra-fast parallel processing queue
    const processingQueue = new Set();
    const MAX_PARALLEL_PROCESSING = 3;
    // ENHANCED SINGLE CODE PROCESSING WITH RETRY LOGIC
    async function processSingleCode(code, value = null) {
        if (processingQueue.size >= MAX_PARALLEL_PROCESSING) {
            log(`⏳ Processing queue full (${processingQueue.size}), queuing ${code}`, 'warning');
            setTimeout(() => processSingleCode(code, value), 0); // Match Auto Claim Drop 6.0: immediate retry
            return;
        }
        processingQueue.add(code);
        currentProcessingCode = code;
        const startTime = Date.now();
        try {
            const valueText = value ? ` (Value: $${value})` : '';
            log(`⚡ PROCESSING: ${code}${valueText}`, 'info');
            addActivityLog(`⚡ Processing: ${code}${valueText}`, 'code_processing');
            updateStatus(`Processing: ${code}${valueText}`, '#ffaa00');

            let result;

            // FORCE API METHOD - don't fall back immediately
            if (CONFIG.USE_API_METHOD) {
                const apiStartTime = Date.now();
                log(`🚀 Using API method: ${code}`, 'info');
                addActivityLog(`🚀 API method: ${code}`, 'code_verification');
                result = await processCodeWithAPI(code);
                const apiTime = Date.now() - apiStartTime;
                log(`⏱️ API processing took ${apiTime}ms`, 'debug');

                // Only fall back to UI if API completely fails (not for timeouts)
                if (!result.success && result.error &&
                    (result.error.includes('session') || result.error.includes('log in'))) {
                    log(`🔄 API auth failed, trying UI method: ${code}`, 'warning');
                    addActivityLog(`🔄 Fallback to UI: ${code}`, 'code_ui');
                    const uiStartTime = Date.now();
                    result = await processCodeWithUI(code);
                    const uiTime = Date.now() - uiStartTime;
                    log(`⏱️ UI fallback took ${uiTime}ms`, 'debug');
                }
            } else {
                const uiStartTime = Date.now();
                log(`🖱️ Using UI method: ${code}`, 'info');
                addActivityLog(`🖱️ UI method: ${code}`, 'code_ui');
                result = await processCodeWithUI(code);
                const uiTime = Date.now() - uiStartTime;
                log(`⏱️ UI processing took ${uiTime}ms`, 'debug');
            }
            const totalTime = Date.now() - startTime;
            if (result.success) {
                if (result.claimed) {
                    const amount = result.amount || 'Unknown amount';
                    const currency = result.currency || '';
                    log(`Code claimed: ${code} - ${amount} ${currency}`, 'success');
                    addActivityLog(`Claimed: ${code}`, 'claim');
                    updateStatus('Waiting for next code...', '#00ff88');
                    showNotification(`⚡ Claimed: ${code} - ${amount} ${currency}`, 'success');
                } else if (result.available === false) {
                    log(`Code not claimed: ${code} - ${result.status || 'Not available'}`, 'warning');
                    addActivityLog(`⚠️ Not available: ${code} - ${result.status}`, 'dismiss');
                    updateStatus('Waiting for next code...', '#ffaa00');
                } else {
                    log(`Code not claimed: ${code} - ${result.error || 'Unknown reason'}`, 'warning');
                    addActivityLog(`⚠️ Not claimed: ${code}`, 'dismiss');
                    updateStatus('Waiting for next code...', '#ffaa00');
                }
            } else {
                const errorMsg = result.error || 'Unknown error';
                log(`Code not claimed: ${code} - ${errorMsg}`, 'error');
                addActivityLog(`❌ Failed: ${code} - ${errorMsg}`, 'error');
                updateStatus('Error - Waiting for next code...', '#ff4444');
            }
        } catch (error) {
            log(`❌ Error processing code ${code}: ${error.message}`, 'error');
            addActivityLog(`❌ Error: ${code} - ${error.message}`, 'error');
            updateStatus('Error - Waiting for next code...', '#ff4444');
        } finally {
            processingQueue.delete(code);
            currentProcessingCode = processingQueue.size > 0 ? Array.from(processingQueue)[0] : '';
        }
    }
    // ==================== ENHANCED UI INTERACTION FUNCTIONS ====================
    async function navigateToOffersPage() {
        const currentUrl = window.location.href;
        const baseUrl = window.location.origin;
        const offersUrl = `${baseUrl}/settings/offers`;
        if (!isOnOffersPage()) {
            log(`🔄 Navigating to offers page: ${offersUrl}`, 'info');
            window.location.href = offersUrl;
            return false;
        }
        return true;
    }
    async function enterCodeInUI(code) {
        try {
            log(`📝 Attempting to enter code in MOJ: ${code}`, 'info');
            addActivityLog(`📝 Entering code: ${code}`, 'code_MOJ');
            const codeInput = await waitForElement(CONFIG.SELECTORS.CODE_INPUT_FALLBACK, 5000);
            if (!codeInput) {
                log('❌ Code input field not found after waiting', 'error');
                return false;
            }
            log(`✅ Found code input field: ${codeInput.tagName}[${codeInput.name || codeInput.id || 'no-id'}]`, 'success');
            codeInput.value = '';
            codeInput.focus();
            codeInput.dispatchEvent(new Event('focus', { bubbles: true }));
            for (let i = 0; i < code.length; i++) {
                codeInput.value += code[i];
                codeInput.dispatchEvent(new Event('input', { bubbles: true }));
                codeInput.dispatchEvent(new Event('keyup', { bubbles: true }));
                await new Promise(resolve => setTimeout(resolve, CONFIG.TIMING.TYPING_DELAY));
            }
            codeInput.dispatchEvent(new Event('change', { bubbles: true }));
            codeInput.dispatchEvent(new Event('blur', { bubbles: true }));
            log(`✅ Code entered successfully: ${code}`, 'success');
            addActivityLog(`Claiming ${code}`, 'code_MOJ');
            return true;
        } catch (error) {
            log(`❌ Failed to enter code in MOJ: ${error.message}`, 'error');
            return false;
        }
    }
    async function clickSubmitButton() {
        try {
            log(`🔍 Looking for submit button...`, 'info');
            await new Promise(resolve => setTimeout(resolve, CONFIG.TIMING.API_CALL_DELAY));
            const submitButton = await waitForElement(CONFIG.SELECTORS.SUBMIT_FALLBACK, 5000);
            if (!submitButton) {
                log('❌ Submit button not found after waiting', 'error');
                return false;
            }
            log(`✅ Found submit button: ${submitButton.textContent.trim()}`, 'success');
            if (submitButton.disabled) {
                log('⚠️ Submit button is disabled', 'warning');
                return false;
            }
            submitButton.focus();
            await new Promise(resolve => setTimeout(resolve, 100));
            submitButton.click();
            submitButton.dispatchEvent(new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window
            }));
            log('🚀 Submit button clicked successfully!', 'success');
            addActivityLog(`🔍 Submit clicked: ${currentProcessingCode}`, 'code_MOJ');
            return true;
        } catch (error) {
            log(`❌ Failed to click submit button: ${error.message}`, 'error');
            return false;
        }
    }
    // ENHANCED MODAL HANDLING WITH RETRY LOGIC
    async function handleModal() {
        try {
            log(`👀 Waiting for modal to appear...`, 'info');
            addActivityLog(`👀 Waiting for modal: ${currentProcessingCode}`, 'code_MOJ');
            await new Promise(resolve => setTimeout(resolve, CONFIG.TIMING.MODAL_WAIT));
            // Check for success/error indicators first
            const successIndicator = findElement(CONFIG.SELECTORS.SUCCESS_INDICATORS);
            const errorIndicator = findElement(CONFIG.SELECTORS.ERROR_INDICATORS);
            if (successIndicator) {
                log(`🎉 SUCCESS: ${successIndicator.textContent.trim()}`, 'success');
                addActivityLog(`🎉 Success: ${successIndicator.textContent.trim()}`, 'claim');
                return true;
            }
            if (errorIndicator) {
                log(`❌ ERROR: ${errorIndicator.textContent.trim()}`, 'error');
                addActivityLog(`❌ Error: ${errorIndicator.textContent.trim()}`, 'error');
                return false;
            }
            // Look for modal
            const modal = findElement(CONFIG.SELECTORS.MODAL);
            if (!modal) {
                log('⚠️ No modal found', 'warning');
                return false;
            }
            log(`✅ Modal found`, 'success');
            // Consolidated single retry loop with timeout for modal and popups
            const buttonFound = await new Promise((resolve) => {
                const startTime = Date.now();
                const maxTimeout = 5000; // 5 seconds timeout
                let claimed = false;
                const consolidatedInterval = setInterval(() => {
                    const elapsed = Date.now() - startTime;
                    if (elapsed > maxTimeout || claimed) {
                        clearInterval(consolidatedInterval);
                        resolve(claimed);
                        return;
                    }
                    try {
                        // PRIORITY 1: Check specific popup button selectors first
                        const specificPopupButton = modal.querySelector('button[data-testid="claim-drop"]') ||
                                                   modal.querySelector('button[data-analytics="claim-drop"]');
                        if (specificPopupButton && isVisible(specificPopupButton)) {
                            try {
                                specificPopupButton.focus();
                                specificPopupButton.click();
                                specificPopupButton.dispatchEvent(new MouseEvent('click', {
                                    bubbles: true,
                                    cancelable: true,
                                    view: window
                                }));
                                log(`🎯 POPUP BUTTON CLICKED: data-testid="claim-drop"`, 'success');
                                addActivityLog(`Claimed ${currentProcessingCode}`, 'claim');
                                // ADDITIONAL STEP: Look for "Done" button after claiming
                                setTimeout(async () => {
                                    await clickDoneButton(modal);
                                }, 500);
                                claimed = true;
                                clearInterval(consolidatedInterval);
                                resolve(true);
                                return;
                            } catch (e) {
                                log(`❌ Failed to click specific popup button: ${e.message}`, 'error');
                            }
                        }
                        // PRIORITY 2: Check modal buttons using queryContains
                        const modalClaimButtons = queryContains('button', 'claim', modal);
                        const modalBonusButtons = queryContains('button', 'bonus', modal);
                        const allModalButtons = [...modalClaimButtons, ...modalBonusButtons];
                        for (const el of allModalButtons) {
                            try {
                                el.focus();
                                el.click();
                                el.dispatchEvent(new MouseEvent('click', {
                                    bubbles: true,
                                    cancelable: true,
                                    view: window
                                }));
                                log(`✅ Clicked modal button (text-based): "${el.textContent.trim()}"`, 'success');
                                addActivityLog(`Claimed ${currentProcessingCode}`, 'claim');
                                // ADDITIONAL STEP: Look for "Done" button after claiming
                                setTimeout(async () => {
                                    await clickDoneButton(modal);
                                }, 500);
                                claimed = true;
                                clearInterval(consolidatedInterval);
                                resolve(true);
                                return;
                            } catch (e) {
                                log(`❌ Failed to click modal button: ${e.message}`, 'error');
                            }
                        }
                        // PRIORITY 3: Check all popups using enhanced targeting
                        for (const popupSelector of CONFIG.SELECTORS.POPUP_SELECTORS) {
                            const popups = document.querySelectorAll(popupSelector);
                            for (const popup of popups) {
                                // Check specific selectors first
                                const specificButton = popup.querySelector('button[data-testid="claim-drop"]') ||
                                                     popup.querySelector('button[data-analytics="claim-drop"]');
                                if (specificButton && isVisible(specificButton)) {
                                    try {
                                        specificButton.focus();
                                        specificButton.click();
                                        specificButton.dispatchEvent(new MouseEvent('click', {
                                            bubbles: true,
                                            cancelable: true,
                                            view: window
                                        }));
                                        log(`🎯 POPUP SPECIFIC BUTTON CLICKED: "${specificButton.textContent.trim()}"`, 'success');
                                        addActivityLog(`Claimed ${currentProcessingCode}`, 'claim');
                                        // ADDITIONAL STEP: Look for "Done" button after claiming
                                        setTimeout(async () => {
                                            await clickDoneButton(popup);
                                        }, 500);
                                        claimed = true;
                                        clearInterval(consolidatedInterval);
                                        resolve(true);
                                        return;
                                    } catch (e) {
                                        log(`❌ Failed to click specific popup button: ${e.message}`, 'error');
                                    }
                                }
                                // Fallback to text-based search
                                const popupClaimButtons = queryContains('button', 'claim', popup);
                                const popupBonusButtons = queryContains('button', 'bonus', popup);
                                const allPopupButtons = [...popupClaimButtons, ...popupBonusButtons];
                                for (const el of allPopupButtons) {
                                    try {
                                        el.focus();
                                        el.click();
                                        el.dispatchEvent(new MouseEvent('click', {
                                            bubbles: true,
                                            cancelable: true,
                                            view: window
                                        }));
                                        log(`✅ Clicked popup button (text-based): "${el.textContent.trim()}"`, 'success');
                                        addActivityLog(`Claimed ${currentProcessingCode}`, 'claim');
                                        // ADDITIONAL STEP: Look for "Done" button after claiming
                                        setTimeout(async () => {
                                            await clickDoneButton(popup);
                                        }, 500);
                                        claimed = true;
                                        clearInterval(consolidatedInterval);
                                        resolve(true);
                                        return;
                                    } catch (e) {
                                        log(`❌ Failed to click popup button: ${e.message}`, 'error');
                                    }
                                }
                            }
                        }
                    } catch (e) {
                        // Continue trying
                    }
                }, 100); // Check every 100ms
            });
            if (buttonFound) {
                log('🎉 BONUS CLAIMED VIA MODAL!', 'success');
                addActivityLog(`🎉 CLAIM BONUS clicked for code: ${currentProcessingCode}`, 'claim');
                updateStatus('Bonus claimed!', '#00ff00');
                return true;
            } else {
                // Try fallback button search
                const claimDismissButton = findElement(CONFIG.SELECTORS.CLAIM_DISMISS_BUTTON, modal) ||
                                         findElement(['button'], modal);
                if (claimDismissButton) {
                    const buttonText = claimDismissButton.textContent.trim();
                    log(`🎯 Found fallback button with text: "${buttonText}"`, 'info');
                    await new Promise(resolve => setTimeout(resolve, CONFIG.TIMING.BUTTON_CLICK_DELAY));
                    claimDismissButton.focus();
                    claimDismissButton.click();
                    claimDismissButton.dispatchEvent(new MouseEvent('click', {
                        bubbles: true,
                        cancelable: true,
                        view: window
                    }));
                    // Use queryContains to check if this is a claim button
                    const isClaimButton = queryContains('button', 'claim', modal).includes(claimDismissButton);
                    if (isClaimButton || buttonText.toLowerCase().includes('claim')) {
                        log('🎉 BONUS CLAIMED!', 'success');
                        addActivityLog(`🎉 CLAIM BONUS clicked for code: ${currentProcessingCode}`, 'claim');
                        updateStatus('Bonus claimed!', '#00ff00');
                        return true;
                    } else {
                        log('✅ Modal dismissed', 'success');
                        addActivityLog(`❌ DISMISS clicked for code: ${currentProcessingCode}`, 'dismiss');
                        updateStatus('Code dismissed', '#ff9900');
                        return false;
                    }
                } else {
                    log('⚠️ No buttons found in modal after retries', 'warning');
                    return false;
                }
            }
        } catch (error) {
            log(`❌ Failed to handle modal: ${error.message}`, 'error');
            return false;
        }
    }
    // ==================== DONE BUTTON HANDLER ====================
    async function clickDoneButton(container = document) {
        try {
            log(`🔍 Looking for Done button...`, 'info');
            addActivityLog(`🔍 Looking for Done button: ${currentProcessingCode}`, 'code_MOJ');
            // Wait a moment for the Done button to appear
            await new Promise(resolve => setTimeout(resolve, 300));
            // Try specific selectors first
            let doneButton = container.querySelector('button[data-testid="claim-reward-done"]') ||
                           container.querySelector('button[data-analytics="claim-reward-done"]');
            if (!doneButton) {
                // Fallback to text-based search
                const doneButtons = queryContains('button', 'done', container);
                if (doneButtons.length > 0) {
                    doneButton = doneButtons[0];
                }
            }
            if (doneButton && isVisible(doneButton)) {
                log(`✅ Found Done button: "${doneButton.textContent.trim()}"`, 'success');
                doneButton.focus();
                await new Promise(resolve => setTimeout(resolve, 100));
                doneButton.click();
                doneButton.dispatchEvent(new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    view: window
                }));
                log(`🎉 DONE BUTTON CLICKED - Claim process completed!`, 'success');
                addActivityLog(`🎉 DONE button clicked - Claim fully completed for code: ${currentProcessingCode}`, 'claim');
                updateStatus('Claim fully completed!', '#00ff00');
                return true;
            } else {
                log(`⚠️ Done button not found or not visible`, 'warning');
                return false;
            }
        } catch (error) {
            log(`❌ Failed to click Done button: ${error.message}`, 'error');
            return false;
        }
    }
    // ==================== ENHANCED MAIN CLAIMING LOGIC ====================
    async function processCodeWithUI(code) {
        // UI fallback is disabled - always return failure
        log(`⚠️ UI method disabled - API-only mode active for ${code}`, 'warning');
        return { success: false, error: 'UI fallback disabled - API-only mode' };
    }
    async function processCodeWithAPI(code) {
        try {
            log(`🚀 ENHANCED PROCESSING: ${code}`, 'info');
            addActivityLog(`🚀 ENHANCED: ${code}`, 'code_verification');

            // ✅ Server-side credit verification now handles this
            // No client-side credit check needed - server only sends codes to eligible users

            // PARALLEL RACE APPROACH: Fire verification and claim simultaneously
            log(`⚡ Firing parallel API calls for maximum speed: ${code}`, 'info');

            const verifyPromise = verifyCodeWithAPI(code);
            const claimPromise = claimBonusCodeWithAPI(code);

            // Race both calls - whichever succeeds first wins
            const results = await Promise.allSettled([verifyPromise, claimPromise]);
            const [verifyResult, claimResult] = results.map(r => r.status === 'fulfilled' ? r.value : { success: false, error: r.reason?.message || 'Promise rejected' });

            log(`📊 Parallel results - Verify: ${verifyResult.success}, Claim: ${claimResult.success}`, 'debug');

            // PRIORITY 1: Check if claim succeeded (fastest path to success)
            if (claimResult.success && claimResult.claimed && claimResult.response) {
                log(`🎉 CLAIM WON THE RACE: Successfully claimed via parallel API: ${code}`, 'success');
                addActivityLog(`🎉 RACE WIN: Claimed ${code}`, 'claim');
                
                // ENHANCED: Process immediate fee deduction
                if (CONFIG.ENHANCED.IMMEDIATE_FEE_DEDUCTION) {
                    log(`⚡ Processing immediate fee deduction for ${code}`, 'info');
                    const enhancedResult = await processClaimSuccess(code, claimResult.response);
                    
                    if (enhancedResult.success) {
                        return {
                            success: true,
                            claimed: true,
                            enhanced_processing: true,
                            fee_processed: enhancedResult.fee_processed,
                            fee_amount: enhancedResult.fee_amount,
                            remaining_credits: enhancedResult.remaining_credits,
                            claimed_amount: enhancedResult.claimed_amount,
                            claimed_currency: enhancedResult.claimed_currency,
                            usd_amount: enhancedResult.usd_amount,
                            response: claimResult.response
                        };
                    } else {
                        // Enhanced processing failed, but claim succeeded
                        log(`⚠️ Enhanced processing failed for ${code}, but claim was successful`, 'warning');
                        return {
                            success: true,
                            claimed: true,
                            enhanced_processing: false,
                            enhanced_error: enhancedResult.error,
                            response: claimResult.response
                        };
                    }
                } else {
                    // Enhanced processing disabled, return original result
                    return claimResult;
                }
            }

            // PRIORITY 2: Check verification result for code availability
            if (!verifyResult.success) {
                log(`❌ Parallel verification failed for ${code}: ${verifyResult.error}`, 'error');
                // Don't fall back to UI for authentication errors
                if (verifyResult.error.includes('log in') || verifyResult.error.includes('session')) {
                    log(`🔐 Authentication issue detected in parallel mode: ${code}`, 'warning');
                    return { success: false, error: verifyResult.error };
                }
                addActivityLog(`❌ Parallel verification failed: ${code} - ${verifyResult.error}`, 'error');
                return { success: false, error: verifyResult.error };
            }

            if (!verifyResult.available) {
                log(`⚠️ Code not available (parallel check): ${code} (Status: ${verifyResult.status})`, 'warning');
                addActivityLog(`Not available: ${code}`, 'dismiss');
                return { success: true, available: false, status: verifyResult.status };
            }

            // PRIORITY 3: Handle claim failures when verification shows code is available
            if (claimResult.success === false && claimResult.error) {
                // Check for timeout errors in parallel claim
                if (claimResult.error.includes('timeout') || claimResult.error.includes('aborted')) {
                    log(`⏰ Parallel claim timeout, checking if claim succeeded: ${code}`, 'warning');
                    addActivityLog(`⏰ Parallel timeout - checking status: ${code}`, 'info');

                    // Quick recheck to see if claim actually succeeded
                    await new Promise(resolve => setTimeout(resolve, 1000)); // Faster recheck
                    const recheckResult = await verifyCodeWithAPI(code);
                    if (recheckResult.success && recheckResult.status === 'alreadyClaimed') {
                        log(`🎉 Parallel claim succeeded despite timeout: ${code}`, 'success');
                        addActivityLog(`🎉 Parallel claim successful (confirmed): ${code}`, 'claim');
                        return { success: true, claimed: true, status: 'claimed_after_timeout' };
                    }
                }

                // Authentication errors don't use UI fallback
                if (claimResult.error.includes('log in') || claimResult.error.includes('session')) {
                    log(`🔐 Parallel claim auth issue: ${code}`, 'error');
                    return { success: false, error: claimResult.error };
                }

                log(`⚠️ Parallel claim failed: ${code} - ${claimResult.error}`, 'warning');
                addActivityLog(`⚠️ Parallel claim failed: ${code}`, 'error');
                return { success: false, error: claimResult.error };
            }

            // Fallback case
            log(`⚠️ Parallel processing completed but no clear result: ${code}`, 'warning');
            return { success: false, error: 'Parallel processing completed without clear success' };

        } catch (error) {
            if (error.name === 'AbortError' || error.message.includes('aborted')) {
                log(`⏰ Request timeout for ${code}, checking if claim succeeded anyway`, 'warning');
                addActivityLog(`⏰ Request timeout: ${code}`, 'info');

                // Wait then check if the code was actually claimed
                await new Promise(resolve => setTimeout(resolve, 3000));
                try {
                    const recheckResult = await verifyCodeWithAPI(code);
                    if (recheckResult.success && recheckResult.status === 'alreadyClaimed') {
                        log(`🎉 Code was claimed despite timeout: ${code}`, 'success');
                        addActivityLog(`🎉 Claim successful (confirmed after timeout): ${code}`, 'claim');
                        return { success: true, claimed: true, status: 'claimed_after_timeout' };
                    }
                } catch (recheckError) {
                    log(`❌ Could not verify claim status after timeout: ${recheckError.message}`, 'error');
                }

                // If recheck failed or code not claimed, try UI fallback
                log(`⚠️ Timeout occurred, trying UI fallback: ${code}`, 'warning');
                return await processCodeWithUI(code);
            } else {
                log(`❌ API processing failed for ${code}: ${error.message}`, 'error');
                addActivityLog(`❌ API error: ${code} - ${error.message}`, 'error');

                // Only use UI fallback for non-authentication errors
                if (!error.message.includes('log in') && !error.message.includes('session')) {
                    log(`⚠️ Trying UI fallback for: ${code}`, 'warning');
                    return await processCodeWithUI(code);
                } else {
                    return { success: false, error: error.message };
                }
            }
        }
    }
    async function processAllCodes() {
        try {
            log(`🚀 Starting code processing...`, 'info');
            addActivityLog('Listening for codes', 'system');
            if (!isOnOffersPage()) {
                const navigated = await navigateToOffersPage();
                if (!navigated) {
                    log(`🔄 Page navigation initiated, script will restart on new page`, 'info');
                    return;
                }
            }
            if (CONFIG.WAIT_FOR_PAGE_READY) {
                log(`⏳ Waiting for page to be ready...`, 'info');
                await new Promise(resolve => setTimeout(resolve, CONFIG.TIMING.PAGE_LOAD_DELAY));
            }
            if (CONFIG.USE_WEBSOCKET_ONLY) {
                log(`⏳ Waiting for new codes via server only (no old codes)...`, 'info');
                addActivityLog('⏳ Waiting for fresh codes via server...', 'system');
                updateStatus('Waiting for new codes...', '#ffaa00');
                return;
            }
            const codes = await fetchCodesFromServer();
            if (codes.length === 0) {
                log(`📭 No codes available to process`, 'warning');
                addActivityLog('📭 No codes available from server', 'system');
                updateStatus('Waiting for codes...', '#ffaa00');
                return;
            }
            codes.forEach(codeData => {
                const code = typeof codeData === 'object' ? codeData.code : codeData;
                const value = typeof codeData === 'object' ? codeData.value : null;
                const valueText = value ? ` ($${value})` : '';
                addActivityLog(`📥 Code received: ${code}${valueText}`, 'code_received');
            });
            log(`📋 Processing ${codes.length} codes...`, 'info');
            addActivityLog(`📋 Processing ${codes.length} codes...`, 'system');
            let successCount = 0;
            let claimedCount = 0;
            let errorCount = 0;
            for (let i = 0; i < codes.length; i++) {
                const codeData = codes[i];
                const code = typeof codeData === 'object' ? codeData.code : codeData;
                const value = typeof codeData === 'object' ? codeData.value : null;
                const valueText = value ? ` (Value: $${value})` : '';
                log(`\n--- Processing code ${i + 1}/${codes.length}: ${code}${valueText} ---`, 'info');
                currentProcessingCode = code;
                addActivityLog(`⚙️ Processing code ${i + 1}/${codes.length}: ${code}${valueText}`, 'code_processing');
                updateStatus(`Processing code ${i + 1}/${codes.length}...`, '#4499ff');
                let result;
                if (CONFIG.USE_API_METHOD) {
                    result = await processCodeWithAPI(code);
                } else {
                    result = await processCodeWithUI(code);
                }
                if (result.success) {
                    successCount++;
                    if (result.claimed) {
                        claimedCount++;
                        addActivityLog(`✅ ${code}`, 'claim');
                    } else {
                        addActivityLog(`⚠️ Code ${code} processed but not claimed`, 'dismiss');
                    }
                } else {
                    errorCount++;
                    addActivityLog(`Error: ${code} - ${result.error}`, 'error');
                }
                if (i < codes.length - 1) {
                    log(`⏳ Waiting before next code...`, 'info');
                    await new Promise(resolve => setTimeout(resolve, CONFIG.TIMING.RETRY_DELAY));
                }
            }
            log(`\nFINAL SUMMARY:`, 'info');
            log(`✅ Total processed: ${codes.length}`, 'info');
            log(`🎉 Successfully claimed: ${claimedCount}`, 'success');
            log(`⚠️ Not available/failed: ${successCount - claimedCount + errorCount}`, 'warning');
            log(`❌ Errors: ${errorCount}`, 'error');
            // Remove summary log for cleaner interface
            updateStatus(`Complete: ${claimedCount} claimed`, claimedCount > 0 ? '#00ff00' : '#ffaa00');
            showNotification(`Processing complete! Claimed: ${claimedCount}/${codes.length}`, 'success');
        } catch (error) {
            log(`💀 Fatal error in processAllCodes: ${error.message}`, 'error');
            showNotification(`Fatal error: ${error.message}`, 'error');
        }
    }
    // ==================== CONTINUOUS POLLING SYSTEM ====================
    function startContinuousPolling() {
        if (pollingInterval) {
            clearInterval(pollingInterval);
        }
        log(`🔄 Starting continuous polling every ${CONFIG.POLL_INTERVAL/1000} seconds`, 'info');
        addActivityLog('🔄 Started continuous code monitoring', 'system');
        updateStatus('Active - Monitoring for codes...', '#4499ff');
        pollingInterval = setInterval(async () => {
            if (!CONFIG.AUTO_CLAIM_ENABLED) {
                log('⏸️ Polling paused (auto-claim disabled)', 'debug');
                return;
            }
            try {
                log('🔍 Polling for new codes...', 'debug');
                const response = await fetch(`${CONFIG.API_BASE_URL}/api/codes`, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'User-Agent': navigator.userAgent
                    },
                    mode: 'cors'
                });
                if (!response.ok) {
                    log(`❌ Polling failed: ${response.status} ${response.statusText}`, 'error');
                    log(`🔧 Check server status at: ${CONFIG.API_BASE_URL}/health`, 'info');
                    return;
                }
                const data = await response.json();
                log(`🔍 Polling response:`, 'debug', data);
                if (data && data.codes && Array.isArray(data.codes) && data.codes.length > 0) {
                    const allCodes = data.codes.map(c => c.toString().toUpperCase());
                    const validCodes = allCodes.filter(isValidStakeCode);
                    if (validCodes.length > 0) {
                        const latestCodeTimestamp = data.latest_updated || Date.now();
                        if (latestCodeTimestamp > lastProcessedCodeTimestamp) {
                            lastProcessedCodeTimestamp = latestCodeTimestamp;
                            for (const codeData of validCodes) {
                                const code = typeof codeData === 'object' ? codeData.code : codeData;
                                const value = typeof codeData === 'object' ? codeData.value : null;
                                const valueText = value ? ` ($${value})` : '';
                                log(`🆕 New valid code detected: ${code}${valueText}`, 'success');
                                addActivityLog(`📥 New code detected: ${code}${valueText}`, 'code_received');
                                await processSingleCode(code, value);
                            }
                        } else {
                            log('📋 Same codes as before, skipping...', 'debug');
                        }
                    } else {
                        log('📭 No valid codes after filtering during polling', 'debug');
                    }
                } else if (data && data.codes && data.codes.length === 0) {
                    log('📭 No codes available during polling (empty array)', 'debug');
                } else {
                    log('📭 No codes available during polling', 'debug');
                    log(`📄 Response data: ${JSON.stringify(data)}`, 'debug');
                }
            } catch (error) {
                log(`❌ Polling error: ${error.message}`, 'error');
            }
        }, CONFIG.POLL_INTERVAL);
    }
    function stopContinuousPolling() {
        if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
            log('⏹️ Continuous polling stopped', 'info');
            addActivityLog('⏹️ Stopped code monitoring', 'system');
        }
    }
    // ==================== USERNAME EXTRACTION FUNCTION ====================
    // ==================== GRAPHQL USERNAME EXTRACTION ====================
    async function getStakeUserFromAPI() {
        try {
            // Read session cookie
            const cookies = document.cookie.split(';');
            let sessionCookie = null;
            for (const cookie of cookies) {
                const [name, value] = cookie.trim().split('=');
                if (name === 'session') {
                    sessionCookie = value;
                    break;
                }
            }
            if (!sessionCookie) {
                log(`❌ No session cookie found`, 'error');
                return null;
            }
            // GraphQL query to get user data
            const query = {
                query: `
                    query {
                        user {
                            id
                            name
                        }
                    }
                `,
                variables: {}
            };
            const response = await fetch('/_api/graphql', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Access-Token': sessionCookie,
                },
                body: JSON.stringify(query)
            });
            if (!response.ok) {
                log(`❌ GraphQL request failed: ${response.status}`, 'error');
                return null;
            }
            const data = await response.json();
            if (data.data && data.data.user && data.data.user.name) {
                const username = data.data.user.name;
                log(`👤 Found username via GraphQL: ${username}`, 'success');
                return username;
            } else {
                log(`❌ No user data in GraphQL response`, 'error');
                return null;
            }
        } catch (error) {
            log(`❌ Error fetching user from MOJ: ${error.message}`, 'error');
            return null;
        }
    }
    function extractStakeUsername() {
        // Return placeholder initially - actual username will be loaded asynchronously
        return 'Loading...';
    }
    // Async function to load and set username
    async function loadAndSetUsername() {
        try {
            // Set placeholder first
            const usernameElement = document.querySelector('#autoDropwrap .username');
            if (usernameElement) {
                usernameElement.textContent = 'Loading...';
            }
            // Try GraphQL API first
            let username = await getStakeUserFromAPI();
            // Fallback to DOM scraping if API fails
            if (!username) {
                log(`⚠️ GraphQL failed, trying DOM fallback`, 'warning');
                // Try profile link method
                username = document.querySelector("a[href^='/profile/']")?.getAttribute("href")?.split("/")[2];
                if (username) {
                    log(`👤 Found username via profile link: ${username}`, 'success');
                } else {
                    // Try span elements as final fallback
                    const usernameElement = document.querySelector('span.weight-semibold.line-height-default.align-left.size-md.text-size-md.variant-highlighted.with-icon-space.svelte-1f6lug3');
                    if (usernameElement && usernameElement.textContent) {
                        username = usernameElement.textContent.trim();
                        if (username && username.length > 0) {
                            log(`👤 Found username via span fallback: ${username}`, 'success');
                        }
                    }
                }
            }
            // Update the username in the UI and global variable
            const targetElement = document.querySelector('#autoDropwrap .username');
            if (targetElement && username) {
                targetElement.textContent = username;
                window.lastKnownStakeUsername = username;
                log(`✅ Username set in #autoDropwrap .username: ${username}`, 'success');
                // Check if username changed
                if (currentStakeUsername !== username) {
                    const oldUsername = currentStakeUsername;
                    currentStakeUsername = username;
                    // Username updated for display only - no need to reconnect WebSocket
                }
                // Set user as authorized if username is found
                userAuthorized = true;
                updateConnectionStatus(true, 'User connected successfully');
                // If we are in WebSocket-only mode and auto-claim is enabled and not connected, connect
                if (CONFIG.AUTO_CLAIM_ENABLED && CONFIG.USE_WEBSOCKET_ONLY &&
                    (!websocketConnection || !websocketConnection.connected)) {
                    connectWebSocket();
                }
            } else if (targetElement) {
                targetElement.textContent = 'Not authorized';
                log(`⚠️ Username not found, showing 'Not authorized'`, 'warning');
                // Set user as unauthorized if username is not found
                currentStakeUsername = null;
                userAuthorized = false;
                updateConnectionStatus(false, 'You are not authorized. Please buy a subscription');
            }
            return username;
        } catch (error) {
            log(`❌ Error in loadAndSetUsername: ${error.message}`, 'error');
            const targetElement = document.querySelector('#autoDropwrap .username');
            if (targetElement) {
                targetElement.textContent = 'Error';
            }
            // Set user as unauthorized if there's an error
            currentStakeUsername = null;
            userAuthorized = false;
            updateConnectionStatus(false, 'You are not authorized. Please buy a subscription');
            return null;
        }
    }
    // ==================== URL CHANGE DETECTION ====================
    function setupURLChangeDetection() {
        if (!CONFIG.CHECK_URL_CHANGES) return;
        let currentUrl = window.location.href;
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;
        history.pushState = function(...args) {
            originalPushState.apply(history, args);
            handleURLChange();
        };
        history.replaceState = function(...args) {
            originalReplaceState.apply(history, args);
            handleURLChange();
        };
        window.addEventListener('popstate', handleURLChange);
        function handleURLChange() {
            if (window.location.href !== currentUrl) {
                currentUrl = window.location.href;
                log(`🔄 URL changed to: ${currentUrl}`, 'debug');
                if (isOnOffersPage()) {
                    log(`✅ Now on offers page, initializing...`, 'info');
                    setTimeout(initializeScript, 1000);
                }
            }
        }
    }
    // ==================== ENHANCED STATUS PANEL FUNCTIONS ====================
    function createStatusPanel() {
        const existingPanel = document.getElementById('autoclaimer-status-panel');
        if (existingPanel) {
            existingPanel.remove();
        }

        // Create show button (hidden by default)
        const showButton = document.createElement('div');
        showButton.id = 'autoclaimer-show-button';
        showButton.style.cssText = `
            position: fixed;
            top: 20px;
            left: 20px;
            z-index: 999998;
            background: linear-gradient(135deg, #2a2a2a, #1a1a1a);
            color: white;
            padding: 8px 12px;
            border-radius: 8px;
            font-family: 'Segoe UI', Arial, sans-serif;
            font-size: 12px;
            cursor: pointer;
            box-shadow: 0 4px 8px rgba(0,0,0,0.4);
            display: none;
            transition: all 0.3s ease;
        `;
        showButton.textContent = '👁️ Show Panel';
        showButton.addEventListener('click', () => {
            const panel = document.getElementById('autoclaimer-status-panel');
            if (panel) {
                panel.style.display = 'block';
                showButton.style.display = 'none';
                addActivityLog('👁️ Panel shown', 'system');
            }
        });
        document.body.appendChild(showButton);

        // Extract username (placeholder initially)
        const username = extractStakeUsername();

        // Create currency options HTML
        const currencyOptions = AVAILABLE_CURRENCIES.map(currency =>
            `<option value="${currency.value}" ${selectedCurrency === currency.value ? 'selected' : ''}>${currency.label}</option>`
        ).join('');

        const panel = document.createElement('div');
        panel.id = 'autoclaimer-status-panel';
        panel.className = 'autoDropwrap';
        panel.style.cssText = `
            position: fixed;
            top: 120px;
            left: 20px;
            z-index: 999999;
            background: linear-gradient(135deg, #2d3748, #4a5568);
            color: white;
            padding: 15px;
            border-radius: 12px;
            font-family: 'Segoe UI', Arial, sans-serif;
            font-size: 14px;
            min-width: 280px;
            max-width: 320px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.6);
            border: 1px solid #4a5568;
            backdrop-filter: blur(10px);
            transition: all 0.3s ease;
        `;
        panel.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; padding-bottom: 8px;">
                <button id="hide-panel" style="background: transparent; color: #888; border: none; padding: 2px 5px; cursor: pointer; font-size: 12px; border-radius: 4px;">❌</button>
                <strong style="font-size: 16px; color: #ffff00; font-weight: bold; flex-grow: 1; text-align: center; text-shadow: 2px 2px 4px rgba(0,0,0,0.8);">Sure Claim</strong>
                <div id="connection-indicator" style="width: 12px; height: 12px; background: #ff0000; border-radius: 50%;"></div>
            </div>

            <div style="margin-bottom: 10px;">
                <div id="activity-log" style="background: rgba(0,0,0,0.8); padding: 10px; border-radius: 6px; font-size: 12px; max-height: 150px; overflow-y: auto; border: 1px solid #2a4a5a; font-family: 'Consolas', 'Monaco', monospace;">
                </div>
            </div>
            <div style="border-top: 1px solid #2a4a5a; padding-top: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center;" id="autoDropwrap">
                    <span class="username" style="color: #ffffff; font-size: 14px;">${username}</span>
                    <span id="bottom-credits-display" style="color: #ffffff; font-size: 14px; cursor: pointer;" onclick="openVoucherPopup()">+ Credit: -- USD</span>
                    <button id="settings-btn" style="background: transparent; color: #888; border: none; padding: 5px; cursor: pointer; font-size: 14px;">⚙️ Settings</button>
                </div>
                <div id="credits-section" style="display: none; margin-top: 10px; padding: 10px; border-top: 1px solid #2a4a5a;">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                        <span style="color:#9dd6ff;">Credits:</span>
                        <strong id="credits-value-expanded" style="color:#fff;">--</strong>
                        <button id="refresh-credits-expanded" style="margin-left:auto;background:#1f4b62;color:#fff;border:0;padding:6px 10px;border-radius:6px;cursor:pointer;">Refresh</button>
                    </div>
                    <div style="text-align:center;margin-top:8px;">
                        <button id="open-voucher-popup" style="background:#2a7f47;color:#fff;border:0;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:12px;">💳 Redeem Voucher</button>
                    </div>
                </div>
            </div>
        `;
        const style = document.createElement('style');
        style.textContent = `
            @keyframes pulse {
                0% { opacity: 1; transform: scale(1); }
                50% { opacity: 0.7; transform: scale(1.1); }
                100% { opacity: 1; transform: scale(1); }
            }
            #autoclaimer-status-panel:hover {
                box-shadow: 0 12px 40px rgba(0,0,0,0.5);
                transform: translateY(-2px);
            }
            #toggle-claimer:hover {
                background: linear-gradient(135deg, #0077ee, #0066cc);
                box-shadow: 0 6px 12px rgba(0,102,204,0.4);
            }
            #clear-log:hover {
                background: linear-gradient(135deg, #777, #666);
                box-shadow: 0 6px 12px rgba(0,0,0,0.3);
            }
            #hide-panel:hover {
                background: linear-gradient(135deg, #ff7733, #ff6600);
                box-shadow: 0 6px 12px rgba(255,102,0,0.4);
            }
            #buy-premium:hover {
                background: linear-gradient(135deg, #00bb7d, #00a86b);
                box-shadow: 0 6px 12px rgba(0,168,107,0.4);
            }
            #autoclaimer-show-button:hover {
                background: linear-gradient(135deg, #0077ee, #0066cc);
                box-shadow: 0 6px 12px rgba(0,102,204,0.4);
            }
            #activity-log::-webkit-scrollbar {
                width: 6px;
            }
            #activity-log::-webkit-scrollbar-track {
                background: rgba(255,255,255,0.1);
                border-radius: 3px;
            }
            #activity-log::-webkit-scrollbar-thumb {
                background: rgba(255,255,255,0.3);
                border-radius: 3px;
            }
            #activity-log::-webkit-scrollbar-thumb:hover {
                background: rgba(255,255,255,0.5);
            }
        `;
        document.head.appendChild(style);
        document.body.appendChild(panel);

        // Add toggle function for credits section
        window.toggleCreditsSection = function() {
            const section = document.getElementById('credits-section');
            if (section) {
                section.style.display = section.style.display === 'none' ? 'block' : 'none';
            }
        };

        // Add voucher popup function
        window.openVoucherPopup = function() {
            // Directly open the popup modal without showing expanded section
            createVoucherPopup();
        };

        // Update credits display function for expandable section
        window.updateCreditsDisplay = (v) => {
            // Update bottom credits display
            const bottomEl = document.getElementById('bottom-credits-display');
            if (bottomEl) {
                const creditValue = typeof v === 'number' ? v.toFixed(1) : '--';
                bottomEl.textContent = `Credit: ${creditValue} USD`;
            }

            // Update expanded credits display
            const expandedEl = document.getElementById('credits-value-expanded');
            if (expandedEl) {
                expandedEl.textContent = typeof v === 'number' ? v.toFixed(8) : v;
            }
        };

        // Setup expanded section controls
        setTimeout(() => {
            const btnRefreshExpanded = document.getElementById('refresh-credits-expanded');
            const btnRedeemExpanded = document.getElementById('voucher-redeem-expanded');
            const inputElExpanded = document.getElementById('voucher-input-expanded');
            const infoElExpanded = document.getElementById('voucher-info-expanded');

            if (btnRefreshExpanded) {
                btnRefreshExpanded.addEventListener('click', async () => {
                    const uname = window.lastKnownStakeUsername || 'unknown';
                    const data = await fetchBalance(uname);
                    if (data && typeof data.credits !== 'undefined') {
                        updateCreditsDisplay(data.credits);
                        showNotification(`✅ Balance: ${data.credits}`, 'success');
                    } else {
                        showNotification('❌ Failed to fetch balance', 'error');
                    }
                });
            }

            // Setup voucher popup button
            const openVoucherBtn = document.getElementById('open-voucher-popup');
            if (openVoucherBtn) {
                openVoucherBtn.addEventListener('click', () => {
                    createVoucherPopup();
                });
            }

            // Remove old input handlers - will be recreated in popup

            // Remove old redemption controls - will be recreated in popup

            // Auto-refresh balance after username is loaded
            setTimeout(() => {
                const uname = window.lastKnownStakeUsername || null;
                if (uname && btnRefreshExpanded) btnRefreshExpanded.click();
            }, 2000);
        }, 1000);

        const hideBtn = document.getElementById('hide-panel');

        hideBtn.addEventListener('click', () => {
            panel.style.display = 'none';
            showButton.style.display = 'block';
            addActivityLog('👁️ Panel hidden', 'system');
        });

        // Enhanced Settings Button with Popup - Complete feature from NOTCLAIMED.js
        const settingsBtn = document.getElementById('settings-btn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                createSettingsPopup();
            });
        }

        window.stakeAutoClaimerPanel = panel;
        window.stakeAutoClaimerShowButton = showButton;
        addActivityLog('AutoClaimer ready', 'system');
        addActivityLog('⏰ Waiting for codes...', 'info');

        // Load username asynchronously after panel is created (one time only)
        loadAndSetUsername();
    }

    // Create Voucher Popup Modal
    function createVoucherPopup() {
        // Remove existing popup if any
        const existingPopup = document.getElementById('voucher-popup');
        if (existingPopup) {
            existingPopup.remove();
        }

        const overlay = document.createElement('div');
        overlay.id = 'voucher-popup-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.7);
            z-index: 999999;
            backdrop-filter: blur(5px);
        `;

        const popup = document.createElement('div');
        popup.id = 'voucher-popup';
        popup.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            z-index: 1000000;
            background: #1a1a1a;
            color: white;
            padding: 25px;
            border-radius: 15px;
            font-family: 'Segoe UI', Arial, sans-serif;
            font-size: 14px;
            min-width: 400px;
            max-width: 500px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.6);
            border: 1px solid #444;
            backdrop-filter: blur(15px);
        `;

        popup.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #444;">
                <h2 style="margin: 0; font-size: 20px; color: #ffff00; text-shadow: 2px 2px 4px rgba(0,0,0,0.8);">💳 Voucher Redemption</h2>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-family: 'Segoe UI', 'Helvetica Neue', sans-serif; font-size: 14px; color: #e2e8f0; font-weight: 500;">Hide Panel</span>
                    <button id="close-voucher-popup" style="background: transparent; color: #888; border: none; font-size: 18px; cursor: pointer; padding: 5px; transition: color 0.2s ease;">✕</button>
                </div>
            </div>

            <!-- Current Balance Display -->
            <div style="margin-bottom: 20px; padding: 10px; background: rgba(0,255,136,0.1); border-radius: 8px; border-left: 3px solid #00ff88;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: #9dd6ff;">Current Balance:</span>
                    <strong id="popup-credits-display" style="color: #00ff88; font-size: 16px;">Loading...</strong>
                </div>
            </div>

            <!-- Voucher Code Input -->
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 8px; color: #aaa; font-size: 14px;">
                    <strong>Voucher Code:</strong>
                </label>
                <input id="popup-voucher-input" placeholder="Enter voucher code" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #555; background: #333; color: white; font-size: 14px; box-sizing: border-box;" />
            </div>

            <!-- Voucher Info Display -->
            <div id="popup-voucher-info" style="color: #9dd6ff; font-size: 13px; margin-bottom: 15px; padding: 8px; background: rgba(255,255,255,0.05); border-radius: 6px; min-height: 20px;">Enter a voucher code to see details</div>

            <!-- Time Logs Console -->
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 8px; color: #aaa; font-size: 14px;">
                    <strong>Activity Log:</strong>
                </label>
                <div id="popup-time-logs" style="background: rgba(0,0,0,0.4); border: 1px solid #374151; border-radius: 6px; padding: 8px; max-height: 120px; overflow-y: auto; font-family: 'Consolas', 'Monaco', monospace; font-size: 11px; color: #d1d5db;">
                    <div style="color: #10b981;">[${new Date().toLocaleTimeString()}] Voucher redemption panel opened</div>
                </div>
            </div>

            <!-- Note Section -->
            <div style="margin-bottom: 20px; padding: 12px; background: rgba(255,193,7,0.1); border-radius: 8px; border-left: 3px solid #ffc107;">
                <div style="display: flex; align-items: center; margin-bottom: 8px;">
                    <strong style="color: #ffc107; font-size: 14px;">📋 Note:</strong>
                </div>
                <div style="color: #e9ecef; font-size: 12px; line-height: 1.4; margin-bottom: 10px;">
                    <div style="margin-bottom: 4px;"><strong>Fee:</strong> 4% of the amount claimed.</div>
                    <div style="margin-bottom: 8px;"><strong>Payment Method:</strong> Automatically deducted from credit each time a code is successfully claimed.</div>
                    <div style="margin-bottom: 10px;">Get redeem code by contacting <strong style="color: #00d4ff;">@sureclaim96</strong></div>
                </div>
                <div style="display: flex; gap: 8px; justify-content: center;">
                    <button onclick="window.open('https://t.me/sureclaim96', '_blank')" style="background: linear-gradient(135deg, #0088cc, #0066aa); color: white; border: none; padding: 8px 12px; border-radius: 6px; font-size: 11px; cursor: pointer; font-weight: bold; display: flex; align-items: center; gap: 4px;">
                        📱 Telegram
                    </button>
                    <button onclick="window.open('https://t.me/+5k6EDT4zKWZmNzU1', '_blank')" style="background: linear-gradient(135deg, #28a745, #1e7e34); color: white; border: none; padding: 8px 12px; border-radius: 6px; font-size: 11px; cursor: pointer; font-weight: bold; display: flex; align-items: center; gap: 4px;">
                        👥 Join our group
                    </button>
                </div>
            </div>

            <!-- Redemption Section -->
            <div id="popup-redeem-section" style="display: none; margin-top: 15px;">
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 8px; color: #aaa; font-size: 14px;">
                        <strong>Amount to Redeem:</strong>
                    </label>
                    <input id="popup-amount-input" type="number" step="0.01" min="0.01" placeholder="Enter amount or leave blank for all" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #555; background: #333; color: white; font-size: 14px; box-sizing: border-box;" />
                </div>

                <div style="display: flex; gap: 10px; margin-top: 20px;">
                    <button id="popup-redeem-amount" style="flex: 1; background: linear-gradient(135deg, #4a9f67, #2a7f47); color: white; border: none; padding: 12px; border-radius: 8px; font-size: 14px; cursor: pointer; font-weight: bold;">Redeem Amount</button>
                    <button id="popup-redeem-all" style="flex: 1; background: linear-gradient(135deg, #00ff88, #00cc6a); color: white; border: none; padding: 12px; border-radius: 8px; font-size: 14px; cursor: pointer; font-weight: bold;">Redeem All</button>
                </div>
            </div>

            <div style="margin-top: 20px; text-align: center;">
                <button id="popup-clear-form" style="background: #666; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-size: 12px; cursor: pointer;">Clear Form</button>
            </div>
        `;

        document.body.appendChild(overlay);
        document.body.appendChild(popup);

        // Setup popup event listeners
        setupVoucherPopupEvents(popup, overlay);

        // Load current balance
        updatePopupBalance();

        // Focus on voucher input
        setTimeout(() => {
            const voucherInput = document.getElementById('popup-voucher-input');
            if (voucherInput) voucherInput.focus();
        }, 100);
    }

    // Add log to popup console
    function addPopupLog(message, type = 'info') {
        const logContainer = document.getElementById('popup-time-logs');
        if (!logContainer) return;

        const time = new Date().toLocaleTimeString();
        const colors = {
            info: '#d1d5db',
            success: '#10b981',
            warning: '#f59e0b',
            error: '#ef4444'
        };

        const logEntry = document.createElement('div');
        logEntry.style.color = colors[type] || colors.info;
        logEntry.textContent = `[${time}] ${message}`;

        logContainer.appendChild(logEntry);
        logContainer.scrollTop = logContainer.scrollHeight;

        // Keep only last 20 log entries
        while (logContainer.children.length > 20) {
            logContainer.removeChild(logContainer.firstChild);
        }
    }

    // Add log to settings console
    function addSettingsLog(message, type = 'info') {
        const logContainer = document.getElementById('settings-time-logs');
        if (!logContainer) return;

        const time = new Date().toLocaleTimeString();
        const colors = {
            info: '#d1d5db',
            success: '#10b981',
            warning: '#f59e0b',
            error: '#ef4444'
        };

        const logEntry = document.createElement('div');
        logEntry.style.color = colors[type] || colors.info;
        logEntry.textContent = `[${time}] ${message}`;

        logContainer.appendChild(logEntry);
        logContainer.scrollTop = logContainer.scrollHeight;

        // Keep only last 15 log entries (smaller space)
        while (logContainer.children.length > 15) {
            logContainer.removeChild(logContainer.firstChild);
        }
    }

    // Setup Voucher Popup Event Listeners
    function setupVoucherPopupEvents(popup, overlay) {
        const closeBtn = document.getElementById('close-voucher-popup');
        const voucherInput = document.getElementById('popup-voucher-input');
        const voucherInfo = document.getElementById('popup-voucher-info');
        const redeemSection = document.getElementById('popup-redeem-section');
        const amountInput = document.getElementById('popup-amount-input');
        const redeemAmountBtn = document.getElementById('popup-redeem-amount');
        const redeemAllBtn = document.getElementById('popup-redeem-all');
        const clearFormBtn = document.getElementById('popup-clear-form');

        // Close popup events
        const closePopup = () => {
            overlay.remove();
            popup.remove();
        };

        if (closeBtn) closeBtn.addEventListener('click', closePopup);
        overlay.addEventListener('click', closePopup);

        // Voucher input with live lookup
        if (voucherInput && voucherInfo) {
            let lookupTimer = null;
            voucherInput.addEventListener('input', () => {
                clearTimeout(lookupTimer);
                const code = voucherInput.value.trim();
                if (!code) {
                    voucherInfo.textContent = 'Enter a voucher code to see details';
                    if (redeemSection) redeemSection.style.display = 'none';
                    return;
                }

                voucherInfo.textContent = 'Looking up voucher...';
                addPopupLog(`Looking up voucher: ${code}`, 'info');
                lookupTimer = setTimeout(async () => {
                    const data = await fetchVoucherInfo(code);
                    if (data) {
                        addPopupLog(`Voucher found: $${data.remaining_value} remaining of $${data.total_value}`, 'success');
                        voucherInfo.innerHTML = `
                            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                                <span>💳 <strong>${data.code}</strong></span>
                                <span>Total: <strong>$${data.total_value}</strong></span>
                            </div>
                            <div style="display: flex; justify-content: space-between;">
                                <span>Remaining: <strong style="color: ${data.remaining_value > 0 ? '#00ff88' : '#ff6b6b'};">$${data.remaining_value}</strong></span>
                                <span>${data.remaining_value > 0 ? '✅ Available' : '❌ Fully redeemed'}</span>
                            </div>
                        `;

                        if (data.remaining_value > 0) {
                            if (redeemSection) {
                                redeemSection.style.display = 'block';
                                if (amountInput) {
                                    amountInput.max = data.remaining_value;
                                    amountInput.placeholder = `Max: $${data.remaining_value}`;
                                }
                            }
                        } else {
                            if (redeemSection) redeemSection.style.display = 'none';
                        }
                    } else {
                        voucherInfo.innerHTML = '<span style="color: #ff6b6b;">❌ Invalid voucher code</span>';
                        addPopupLog(`Invalid voucher code: ${code}`, 'error');
                        if (redeemSection) redeemSection.style.display = 'none';
                    }
                }, 500);
            });
        }

        // Redeem amount button
        if (redeemAmountBtn && amountInput && voucherInput) {
            redeemAmountBtn.addEventListener('click', async () => {
                const uname = window.lastKnownStakeUsername || 'unknown';
                const vcode = voucherInput.value.trim();
                const amount = parseFloat(amountInput.value);

                if (!vcode) return showNotification('Enter voucher code', 'warning');
                if (!amount || amount <= 0) return showNotification('Enter valid amount', 'warning');

                addPopupLog(`Attempting to redeem $${amount} from voucher ${vcode}`, 'info');
                const result = await redeemVoucher(uname, vcode, amount);
                if (result && result.ok) {
                    addPopupLog(`Successfully redeemed $${amount}. New balance: $${result.credits}`, 'success');
                    updatePopupBalance();
                    voucherInput.value = '';
                    amountInput.value = '';
                    voucherInfo.textContent = 'Enter a voucher code to see details';
                    if (redeemSection) redeemSection.style.display = 'none';
                } else {
                    addPopupLog(`Failed to redeem voucher: ${vcode}`, 'error');
                }
            });
        }

        // Redeem all button
        if (redeemAllBtn && voucherInput) {
            redeemAllBtn.addEventListener('click', async () => {
                const uname = window.lastKnownStakeUsername || 'unknown';
                const vcode = voucherInput.value.trim();
                if (!vcode) return showNotification('Enter voucher code', 'warning');

                addPopupLog(`Attempting to redeem all remaining value from voucher ${vcode}`, 'info');
                const result = await redeemVoucher(uname, vcode); // No amount = redeem all
                if (result && result.ok) {
                    addPopupLog(`Successfully redeemed all $${result.redeemed}. New balance: $${result.credits}`, 'success');
                    updatePopupBalance();
                    voucherInput.value = '';
                    if (amountInput) amountInput.value = '';
                    voucherInfo.textContent = 'Enter a voucher code to see details';
                    if (redeemSection) redeemSection.style.display = 'none';
                } else {
                    addPopupLog(`Failed to redeem voucher: ${vcode}`, 'error');
                }
            });
        }

        // Clear form button
        if (clearFormBtn) {
            clearFormBtn.addEventListener('click', () => {
                addPopupLog('Form cleared', 'info');
                if (voucherInput) voucherInput.value = '';
                if (amountInput) amountInput.value = '';
                if (voucherInfo) voucherInfo.textContent = 'Enter a voucher code to see details';
                if (redeemSection) redeemSection.style.display = 'none';
            });
        }

        // Enter key support
        if (amountInput && redeemAmountBtn) {
            amountInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    redeemAmountBtn.click();
                }
            });
        }
    }

    // Update popup balance display
    async function updatePopupBalance() {
        const balanceDisplay = document.getElementById('popup-credits-display');
        if (!balanceDisplay) return;

        const uname = window.lastKnownStakeUsername || 'unknown';
        try {
            const data = await fetchBalance(uname);
            if (data && typeof data.credits !== 'undefined') {
                balanceDisplay.textContent = `$${data.credits}`;
                // Also update main display
                updateCreditsDisplay(data.credits);
            } else {
                balanceDisplay.textContent = 'Error loading';
            }
        } catch (e) {
            balanceDisplay.textContent = 'Error loading';
        }
    }

    // Enhanced Settings Popup with Full Currency List and Value Filters with Tick Marks
    function createSettingsPopup() {
        // Remove existing popup if any
        const existingPopup = document.getElementById('settings-popup');
        if (existingPopup) {
            existingPopup.remove();
        }

        // Create currency options HTML
        const currencyOptions = AVAILABLE_CURRENCIES.map(currency =>
            `<option value="${currency.value}" ${selectedCurrency === currency.value ? 'selected' : ''}>${currency.label}</option>`
        ).join('');

        const popup = document.createElement('div');
        popup.id = 'settings-popup';
        popup.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            z-index: 1000000;
            background: linear-gradient(135deg, #1e3a8a, #1e40af);
            color: white;
            padding: 25px;
            border-radius: 15px;
            font-family: 'Segoe UI', Arial, sans-serif;
            font-size: 14px;
            min-width: 400px;
            max-width: 500px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.6);
            border: 1px solid #444;
            backdrop-filter: blur(15px);
        `;

        popup.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #444;">
                <h2 style="margin: 0; font-size: 20px; color: #ffff00; text-shadow: 2px 2px 4px rgba(0,0,0,0.8);">⚙️ Settings</h2>
                <button id="close-settings" style="background: transparent; color: #888; border: none; font-size: 18px; cursor: pointer; padding: 5px;">✕</button>
            </div>

            <!-- Settings Activity Log -->
            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 8px; color: #aaa; font-size: 14px;">
                    <strong>Activity Log:</strong>
                </label>
                <div id="settings-time-logs" style="background: rgba(0,0,0,0.4); border: 1px solid #374151; border-radius: 6px; padding: 8px; max-height: 100px; overflow-y: auto; font-family: 'Consolas', 'Monaco', monospace; font-size: 11px; color: #d1d5db;">
                    <div style="color: #10b981;">[${new Date().toLocaleTimeString()}] Settings panel opened</div>
                </div>
            </div>

            <!-- Currency Selection Section -->
            <div style="margin-bottom: 20px;">
                <div style="font-size: 14px; color: #aaa; margin-bottom: 8px; display: flex; align-items: center;">
                    <svg style="width:16px; height:16px; margin-right:8px; fill:#aaa;" viewBox="0 0 24 24"><path d="M7,18c-1.1,0 -1.99,0.9 -1.99,2S5.9,22 7,22s2,-0.9 2,-2S8.1,18 7,18M1,2v2h2l3.6,7.59 -1.35,2.45c-0.16,0.28 -0.25,0.61 -0.25,0.96 0,1.1 0.9,2 2,2h12v-2H7.42c-0.14,0 -0.25,-0.11 -0.25,-0.25l0,-0.03 0.9,-1.63h7.45c0.75,0 1.41,-0.41 1.75,-1.03l3.58,-6.49c0.08,-0.14 0.12,-0.31 0.12,-0.48 0,-0.55 -0.45,-1 -1,-1H5.21l-0.94,-2M17,18c-1.1,0 -1.99,0.9 -1.99,2s0.89,2 1.99,2 2,-0.9 2,-2 -0.9,-2 -2,-2M15,9l1.5,-1.5L19,10l-2.5,2.5L15,11l1.5,-1.5L15,9z"/></svg>
                    <strong>Withdrawal Currency:</strong>
                </div>
                <select id="currency-select-popup" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid #555; background: #333; color: white; font-size: 14px;">
                    ${currencyOptions}
                </select>
            </div>

            <!-- Value Filter Section with Enhanced Tick Marks -->
            <div style="margin-bottom: 20px;">
                <div style="font-size: 14px; color: #aaa; margin-bottom: 12px; display: flex; align-items: center;">
                    <svg style="width:16px; height:16px; margin-right:8px; fill:#aaa;" viewBox="0 0 24 24"><path d="M7,15H9C9,16.08 10.37,17 12,17C13.63,17 15,16.08 15,15C15,13.9 13.96,13.5 11.76,12.97C9.64,12.44 7,11.78 7,9C7,7.21 8.47,5.69 10.5,5.18V3H13.5V5.18C15.53,5.69 17,7.21 17,9H15C15,7.92 13.63,7 12,7C10.37,7 9,7.92 9,9C9,10.1 10.04,10.5 12.24,11.03C14.36,11.56 17,12.22 17,15C17,16.79 15.53,18.31 13.5,18.82V21H10.5V18.82C8.47,18.31 7,16.79 7,15Z"/></svg>
                    <strong>Value Filter (Select bonus amounts to claim):</strong>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-top: 10px;">
                    <label style="display: flex; align-items: center; color: #ddd; font-size: 14px; cursor: pointer; padding: 8px; border-radius: 6px; background: rgba(255,255,255,0.05); transition: all 0.2s ease;">
                        <input type="checkbox" id="value-1-popup" style="margin-right: 10px; transform: scale(1.2); accent-color: #00ff88;">
                        <span style="display: flex; align-items: center;">
                            <span style="margin-right: 6px;">$1</span>
                            <span id="tick-1" style="color: #00ff88; font-size: 16px; display: none;">✓</span>
                        </span>
                    </label>
                    <label style="display: flex; align-items: center; color: #ddd; font-size: 14px; cursor: pointer; padding: 8px; border-radius: 6px; background: rgba(255,255,255,0.05); transition: all 0.2s ease;">
                        <input type="checkbox" id="value-2-popup" style="margin-right: 10px; transform: scale(1.2); accent-color: #00ff88;">
                        <span style="display: flex; align-items: center;">
                            <span style="margin-right: 6px;">$2</span>
                            <span id="tick-2" style="color: #00ff88; font-size: 16px; display: none;">✓</span>
                        </span>
                    </label>
                    <label style="display: flex; align-items: center; color: #ddd; font-size: 14px; cursor: pointer; padding: 8px; border-radius: 6px; background: rgba(255,255,255,0.05); transition: all 0.2s ease;">
                        <input type="checkbox" id="value-3-popup" style="margin-right: 10px; transform: scale(1.2); accent-color: #00ff88;">
                        <span style="display: flex; align-items: center;">
                            <span style="margin-right: 6px;">$3</span>
                            <span id="tick-3" style="color: #00ff88; font-size: 16px; display: none;">✓</span>
                        </span>
                    </label>
                    <label style="display: flex; align-items: center; color: #ddd; font-size: 14px; cursor: pointer; padding: 8px; border-radius: 6px; background: rgba(255,255,255,0.05); transition: all 0.2s ease;">
                        <input type="checkbox" id="value-4-popup" style="margin-right: 10px; transform: scale(1.2); accent-color: #00ff88;">
                        <span style="display: flex; align-items: center;">
                            <span style="margin-right: 6px;">$4</span>
                            <span id="tick-4" style="color: #00ff88; font-size: 16px; display: none;">✓</span>
                        </span>
                    </label>
                    <label style="display: flex; align-items: center; color: #ddd; font-size: 14px; cursor: pointer; padding: 8px; border-radius: 6px; background: rgba(255,255,255,0.05); transition: all 0.2s ease;">
                        <input type="checkbox" id="value-5-popup" style="margin-right: 10px; transform: scale(1.2); accent-color: #00ff88;">
                        <span style="display: flex; align-items: center;">
                            <span style="margin-right: 6px;">$5</span>
                            <span id="tick-5" style="color: #00ff88; font-size: 16px; display: none;">✓</span>
                        </span>
                    </label>
                    <label style="display: flex; align-items: center; color: #ddd; font-size: 14px; cursor: pointer; padding: 8px; border-radius: 6px; background: rgba(255,255,255,0.05); transition: all 0.2s ease;">
                        <input type="checkbox" id="value-6.25-popup" style="margin-right: 10px; transform: scale(1.2); accent-color: #00ff88;">
                        <span style="display: flex; align-items: center;">
                            <span style="margin-right: 6px;">$6.25</span>
                            <span id="tick-6.25" style="color: #00ff88; font-size: 16px; display: none;">✓</span>
                        </span>
                    </label>
                    <label style="display: flex; align-items: center; color: #ddd; font-size: 14px; cursor: pointer; padding: 8px; border-radius: 6px; background: rgba(255,255,255,0.05); transition: all 0.2s ease;">
                        <input type="checkbox" id="value-12.50-popup" style="margin-right: 10px; transform: scale(1.2); accent-color: #00ff88;">
                        <span style="display: flex; align-items: center;">
                            <span style="margin-right: 6px;">$12.50</span>
                            <span id="tick-12.50" style="color: #00ff88; font-size: 16px; display: none;">✓</span>
                        </span>
                    </label>
                    <label style="display: flex; align-items: center; color: #ddd; font-size: 14px; cursor: pointer; padding: 8px; border-radius: 6px; background: rgba(255,255,255,0.05); transition: all 0.2s ease;">
                        <input type="checkbox" id="value-25-popup" style="margin-right: 10px; transform: scale(1.2); accent-color: #00ff88;">
                        <span style="display: flex; align-items: center;">
                            <span style="margin-right: 6px;">$25</span>
                            <span id="tick-25" style="color: #00ff88; font-size: 16px; display: none;">✓</span>
                        </span>
                    </label>
                    <label style="display: flex; align-items: center; color: #ddd; font-size: 14px; cursor: pointer; padding: 8px; border-radius: 6px; background: rgba(255,255,255,0.05); transition: all 0.2s ease;">
                        <input type="checkbox" id="value-50-popup" style="margin-right: 10px; transform: scale(1.2); accent-color: #00ff88;">
                        <span style="display: flex; align-items: center;">
                            <span style="margin-right: 6px;">$50</span>
                            <span id="tick-50" style="color: #00ff88; font-size: 16px; display: none;">✓</span>
                        </span>
                    </label>
                    <label style="display: flex; align-items: center; color: #ddd; font-size: 14px; cursor: pointer; padding: 8px; border-radius: 6px; background: rgba(255,255,255,0.05); transition: all 0.2s ease;">
                        <input type="checkbox" id="value-high-popup" style="margin-right: 10px; transform: scale(1.2); accent-color: #00ff88;">
                        <span style="display: flex; align-items: center;">
                            <span style="margin-right: 6px;">High Rollers (>$50)</span>
                            <span id="tick-high" style="color: #00ff88; font-size: 16px; display: none;">✓</span>
                        </span>
                    </label>
                    <label style="display: flex; align-items: center; color: #ddd; font-size: 14px; cursor: pointer; padding: 8px; border-radius: 6px; background: rgba(255,255,255,0.05); transition: all 0.2s ease;">
                        <input type="checkbox" id="value-all-popup" style="margin-right: 10px; transform: scale(1.2); accent-color: #00ff88;">
                        <span style="display: flex; align-items: center;">
                            <span style="margin-right: 6px;">ALL (Streamers)</span>
                            <span id="tick-all" style="color: #00ff88; font-size: 16px; display: none;">✓</span>
                        </span>
                    </label>
                </div>
                <div style="font-size: 12px; color: #888; margin-top: 10px; padding: 8px; background: rgba(0,255,136,0.1); border-radius: 6px; border-left: 3px solid #00ff88;">
                    💡 <strong>Tips:</strong> High Rollers = Claims all bonuses above $50 | ALL = Claims everything regardless of value | No selection = Claims all codes
                </div>
            </div>

            <div style="display: flex; gap: 10px; margin-top: 25px;">
                <button id="save-settings" style="flex: 1; background: linear-gradient(135deg, #00ff88, #00cc6a); color: white; border: none; padding: 12px; border-radius: 8px; font-size: 14px; cursor: pointer; font-weight: bold; transition: all 0.2s ease;">Save Settings</button>
                <button id="cancel-settings" style="flex: 1; background: linear-gradient(135deg, #666, #555); color: white; border: none; padding: 12px; border-radius: 8px; font-size: 14px; cursor: pointer; font-weight: bold; transition: all 0.2s ease;">Cancel</button>
            </div>
        `;

        // Add overlay background
        const overlay = document.createElement('div');
        overlay.id = 'settings-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.7);
            z-index: 999999;
            backdrop-filter: blur(5px);
        `;

        document.body.appendChild(overlay);
        document.body.appendChild(popup);

        // Load current settings and show tick marks
        const savedValueFilters = localStorage.getItem('selectedValueFilters');
        if (savedValueFilters) {
            try {
                const parsedFilters = JSON.parse(savedValueFilters);
                Object.entries(parsedFilters).forEach(([key, checked]) => {
                    const checkbox = document.getElementById(`value-${key}-popup`);
                    const tick = document.getElementById(`tick-${key}`);
                    if (checkbox && tick) {
                        checkbox.checked = checked;
                        tick.style.display = checked ? 'inline' : 'none';
                    }
                });
            } catch (error) {
                log('Error loading saved value filters', 'warning');
            }
        }

        // Set currency selection
        const currencySelect = document.getElementById('currency-select-popup');
        if (currencySelect) {
            currencySelect.value = selectedCurrency;
            currencySelect.addEventListener('change', () => {
                addSettingsLog(`Currency selection changed to: ${currencySelect.value}`, 'info');
            });
        }

        // Log initial settings state
        setTimeout(() => {
            addSettingsLog(`Current currency: ${selectedCurrency}`, 'info');
        }, 100);

        // Add event listeners for tick marks
        const valueCheckboxes = ['1', '2', '3', '4', '5', '6.25', '12.50', '25', '50', 'high', 'all'];
        valueCheckboxes.forEach(value => {
            const checkbox = document.getElementById(`value-${value}-popup`);
            const tick = document.getElementById(`tick-${value}`);
            if (checkbox && tick) {
                checkbox.addEventListener('change', () => {
                    tick.style.display = checkbox.checked ? 'inline' : 'none';
                    const action = checkbox.checked ? 'enabled' : 'disabled';
                    addSettingsLog(`Filter ${value} ${action}`, 'info');
                });
            }
        });

        // Close popup handlers
        const closePopup = () => {
            addSettingsLog('Settings panel closed', 'info');
            overlay.remove();
            popup.remove();
        };

        document.getElementById('close-settings').addEventListener('click', closePopup);
        document.getElementById('cancel-settings').addEventListener('click', () => {
            addSettingsLog('Settings cancelled - no changes saved', 'warning');
            closePopup();
        });
        overlay.addEventListener('click', closePopup);

        // Save settings handler
        document.getElementById('save-settings').addEventListener('click', () => {
            addSettingsLog('Saving settings...', 'info');
            // Save currency
            const newCurrency = currencySelect.value;
            selectedCurrency = newCurrency;
            localStorage.setItem('selectedCurrency', newCurrency);
            addSettingsLog(`Currency saved: ${newCurrency}`, 'success');

            // Save value filters
            const newValueFilters = {};
            valueCheckboxes.forEach(value => {
                const checkbox = document.getElementById(`value-${value}-popup`);
                if (checkbox) {
                    newValueFilters[value] = checkbox.checked;
                }
            });

            localStorage.setItem('selectedValueFilters', JSON.stringify(newValueFilters));

            // Log saved filters
            const enabledFilters = Object.entries(newValueFilters).filter(([key, enabled]) => enabled).map(([key]) => key);
            if (enabledFilters.length > 0) {
                addSettingsLog(`Value filters saved: ${enabledFilters.join(', ')}`, 'success');
            } else {
                addSettingsLog('All value filters disabled', 'success');
            }
            addSettingsLog('Settings saved successfully!', 'success');

            // Update activity log
            const selectedCurrencyObj = AVAILABLE_CURRENCIES.find(c => c.value === newCurrency);
            const currencyLabel = selectedCurrencyObj ? selectedCurrencyObj.label : newCurrency.toUpperCase();
            addActivityLog(`Currency: ${currencyLabel}`, 'system');

            const activeFilters = Object.entries(newValueFilters)
                .filter(([key, value]) => value)
                .map(([key]) => {
                    if (key === 'high') return 'High Rollers';
                    if (key === 'all') return 'ALL';
                    return `$${key}`;
                })
                .join(', ');

            if (activeFilters) {
                addActivityLog(`Filters: ${activeFilters}`, 'system');
            } else {
                addActivityLog(`Claiming all codes`, 'system');
            }

            closePopup();
        });
    }

    function updateConnectionStatus(connected, message) {
        const indicator = document.getElementById('connection-indicator');
        if (indicator) {
            if (connected) {
                indicator.style.backgroundColor = '#00ff00'; // Green
                indicator.title = message || 'Connected';
            } else {
                indicator.style.backgroundColor = '#ff0000'; // Red
                indicator.title = message || 'Disconnected';
            }
        }
    }
    function updateStatus(statusText, color = '#00ff88') {
        const statusElement = document.getElementById('activity-status');
        if (statusElement) {
            statusElement.textContent = statusText;
            statusElement.style.color = color;
        }
    }
    function addActivityLog(message, type = 'info') {
        const logElement = document.getElementById('activity-log');
        if (logElement) {
            const time = new Date().toLocaleTimeString();
            const colors = {
                info: '#d1d5db',
                success: '#10b981',
                warning: '#f59e0b',
                error: '#ef4444',
                system: '#60a5fa',
                code_received: '#a78bfa',
                dismiss: '#9ca3af'
            };

            const logEntry = document.createElement('div');
            logEntry.style.cssText = `color: ${colors[type] || colors.info}; margin-bottom: 8px; word-wrap: break-word; padding: 2px 0; line-height: 1.4; font-family: 'Consolas', 'Monaco', monospace;`;
            logEntry.textContent = `[${time}] ${message}`;
            logElement.appendChild(logEntry);
            logElement.scrollTop = logElement.scrollHeight;
            while (logElement.children.length > 10) {
                logElement.removeChild(logElement.firstChild);
            }
        }
    }
    function createDebugPanel() {
        const panel = document.createElement('div');
        panel.id = 'autoclaimer-debug-panel';
        panel.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 20px;
            z-index: 999998;
            background: rgba(0,0,0,0.9);
            color: white;
            padding: 10px;
            border-radius: 5px;
            font-family: monospace;
            font-size: 12px;
            max-width: 300px;
            display: none;
        `;
        panel.innerHTML = `
            <div><strong>AutoClaimer Debug</strong></div>
            <div>Version: 3.4</div>
            <div>URL: ${window.location.pathname}</div>
            <div>On Offers Page: ${isOnOffersPage()}</div>
            <div>Auto-claim: ${CONFIG.AUTO_CLAIM_ENABLED}</div>
            <div>Username: ${currentStakeUsername || 'Not loaded'}</div>
            <button onclick="window.autoClaimerDebug.toggle()">Toggle Logs</button>
            <button onclick="window.autoClaimerDebug.runManual()">Run Manual</button>
        `;
        document.body.appendChild(panel);
        window.autoClaimerDebug = {
            toggle: () => {
                const logs = window.autoClaimerLogs || [];
                if (CONFIG.DEBUG_MODE) {
                    originalConsoleLog.group('AutoClaimer Logs');
                    logs.forEach(log => originalConsoleLog(`[${log.timestamp}] ${log.message}`, log.data));
                    originalConsoleLog.groupEnd();
                }
            },
            runManual: () => processAllCodes(),
            panel: panel
        };
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.code === 'KeyA') {
                panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
            }
        });
    }
    // ==================== INITIALIZATION ====================
    async function initializeScript() {
        try {
            log(`🚀 Initializing AutoClaimer v3.4...`, 'info');
            log(`📍 Current URL: ${window.location.href}`, 'debug');
            log(`🎯 On offers page: ${isOnOffersPage()}`, 'debug');
            setupURLChangeDetection();
            if (CONFIG.DEBUG_MODE) {
                createDebugPanel();
            }
            createStatusPanel();
            if (CONFIG.AUTO_CLAIM_ENABLED) {
                if (isOnOffersPage()) {
                    log(`✅ Auto-claim enabled and on offers page, starting processing...`, 'info');
                    await processAllCodes();
                    if (CONFIG.CONTINUOUS_POLLING && !CONFIG.USE_WEBSOCKET_ONLY) {
                        startContinuousPolling();
                    } else if (CONFIG.USE_WEBSOCKET_ONLY) {
                        log(`🔌 Using server-only mode - no polling for old codes`, 'info');
                        addActivityLog('Waiting for codes', 'system');
                        // WebSocket connection will be established after username is loaded
                    }
                } else {
                    log(`⏳ Auto-claim enabled but not on offers page, will start polling anyway...`, 'info');
                    if (CONFIG.CONTINUOUS_POLLING && !CONFIG.USE_WEBSOCKET_ONLY) {
                        startContinuousPolling();
                    } else if (CONFIG.USE_WEBSOCKET_ONLY) {
                        log(`🔌 Using server-only mode - connecting to real-time feed`, 'info');
                        // WebSocket connection will be established after username is loaded
                    }
                }
            } else {
                log(`⏸️ Auto-claim disabled`, 'warning');
            }
        } catch (error) {
            log(`💀 Fatal initialization error: ${error.message}`, 'error');
        }
    }
    // Load Turnstile script immediately
    loadTurnstileScript();


    // Start the script when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeScript);
    } else {
        // If DOM is already ready, initialize immediately with a slight delay
        setTimeout(initializeScript, 100);
    }
    // Expose for debugging
    window.stakeAutoClaimer = {
        CONFIG,
        log,
        processAllCodes,
        verifyCodeWithAPI,
        fetchCodesFromServer,
        isOnOffersPage,
        findElement,
        waitAndClick,
        createVoucherPopup,
        version: '3.4',
        currentStakeUsername: () => currentStakeUsername
    };
    log(`🎯 Stake AutoClaimer v3.4 loaded successfully with username-based server!`, 'success');
})();