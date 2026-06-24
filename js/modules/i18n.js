// Multi-Language i18n Engine Module
import { state } from './state.js?v=2.2.0';

const TRANSLATIONS = {
    'en': {
        'nav_home': 'Home',
        'nav_market': 'Market',
        'nav_follow': 'Follow',
        'nav_assets': 'Assets',
        'nav_profile': 'Profile',
        'home_title': 'Follow AI Strategies',
        'home_subtitle': 'Smart Trading, Easy Profits',
        'home_desc': 'Let AI trade for you and enjoy steady profits',
        'home_cta': 'Start Follow <span class="btn-arrow">→</span>',
        'home_guest_title': 'You are currently not logged in',
        'home_guest_desc': 'Log in now to secure your profile and start AI copy trading',
        'home_guest_btn': 'Secure Login',
        'quick_ai_strategy': 'AI Strategy',
        'quick_follow_leaderboard': 'Leaderboard',
        'quick_academy': 'Academy',
        'quick_invite': 'Invite Friends',
        'section_market_overview': 'Market Overview',
        'section_featured_strategies': '🔥 Featured AI Strategies',
        'section_live_profits': '📢 Live Follow Profits',
        'section_more': 'More ›',
        'loading_featured': 'Loading featured strategies...',
        'home_ticker_followed': 'followed',
        'home_ticker_just_now': 'Just now',
        'home_ticker_1min_ago': '1 min ago',
        'market_title': 'Market Watch',
        'loading_market_list': 'Fetching live market feeds...',
        'market_back_to_market': 'Back to Market',
        'market_h24': '24h High',
        'market_l24': '24h Low',
        'market_chart_title': '1M Live Trend Candlestick Chart',
        'market_depth_title': 'Order Book',
        'market_depth_price': 'Price',
        'market_depth_qty': 'Amount',
        'market_trades_title': 'Recent Trades',
        'market_trades_time': 'Time',
        'follow_title': 'AI Quant Strategies',
        'filter_all': 'All',
        'filter_stable': 'Stable',
        'filter_high': 'High Yield',
        'filter_short': 'Short Term',
        'loading_strategies': 'Fetching servers quant strategies...',
        'assets_title': 'My Follows',
        'assets_total_invest_lbl': 'Total Invested (USDT)',
        'assets_total_profit_lbl': 'Total Profits (USDT)',
        'assets_deposit_btn': 'Deposit Funds (Fiat/Crypto)',
        'assets_withdraw_btn': 'Withdraw Funds (UPI/Bank)',
        'assets_tab_active': 'Active',
        'assets_tab_history': 'History',
        'assets_tab_stopped': 'Stopped',
        'assets_login_warning': 'Please log in to load your quant order records',
        'profile_nickname_guest': 'Guest (Not logged in)',
        'profile_total_assets_lbl': 'Total Assets (USDT)',
        'profile_today_profit_lbl': 'Today\'s Profit',
        'profile_deposit': 'Deposit',
        'profile_withdraw': 'Withdraw',
        'profile_txrecords': 'Transactions',
        'profile_funddetails': 'Fund Details',
        'profile_menu_my_follow': 'My Follow Positions',
        'profile_menu_my_watchlist': 'My Watchlist',
        'profile_menu_invite': 'Invite Friends',
        'profile_menu_invite_badge': 'Earn Rewards',
        'profile_menu_academy': 'Quant Academy',
        'profile_menu_help': 'Help Center',
        'profile_menu_lang': 'Language Settings',
        'profile_menu_kyc': 'KYC Verification',
        'profile_kyc_unverified': 'Unverified',
        'profile_logout_btn': 'Secure Sign Out',
        'drawer_title_model': 'Model Selection',
        'drawer_title_risk': 'Risk Level',
        'drawer_risk_low': 'Low',
        'drawer_risk_medium': 'Medium',
        'drawer_risk_high': 'High',
        'drawer_title_stoploss': 'Stop Loss',
        'drawer_avail_balance': 'Available Balance',
        'drawer_add_funds': 'Add Funds',
        'drawer_agree_terms': 'I have read and agree to the <a href="javascript:void(0)" onclick="openPlatformAgreementModal(\'advisory-agree\', event)" style="color: var(--primary); text-decoration: underline;">Copy Trading Service Agreement</a>',
        'drawer_agree_terms_short': 'I agree to the <a href="javascript:void(0)" onclick="openPlatformAgreementModal(\'advisory-agree\', event)" style="color: #1534B9; text-decoration: underline; font-weight: 700;">AI Trading Risk Acknowledgement</a>',
        'drawer_submit_btn': 'Review by order',
        'success_title': 'Order Submitted Successfully',
        'success_subtitle': 'Please wait for system audit verification',
        'success_lbl_order_id': 'Quant Follow ID',
        'success_lbl_amount': 'Invested Assets',
        'success_lbl_stoploss': 'Max Stop Loss Rate',
        'success_lbl_time': 'Deployment Time',
        'success_btn_positions': 'Positions Detail',
        'success_btn_home': 'Back to Lobby',
        'kyc_title': 'KYC Compliance Realname Verification',
        'kyc_desc': 'Submit realname identity info to activate full AI trading privileges',
        'kyc_name_lbl': 'Real Name',
        'kyc_name_placeholder': 'Enter full name as on ID document',
        'kyc_type_lbl': 'ID Document Type',
        'kyc_number_lbl': 'Document Number',
        'kyc_number_placeholder': 'Enter ID document number',
        'kyc_privacy': '🔒 Sensitive data encrypted via AES-256 locally for AML audits only.',
        'kyc_submit': 'Submit KYC Application',
        'auth_title': 'AI Trading Quick Login',
        'auth_desc': 'One-click OTP via SMS for instant secure registration',
        'auth_phone_lbl': 'Mobile Phone Number',
        'auth_phone_placeholder': '',
        'auth_code_lbl': 'SMS Verification Code (OTP)',
        'auth_code_placeholder': 'Enter 6-digit OTP code',
        'auth_btn_send_otp': 'Send OTP',
        'auth_btn_submit': 'Log In / Register Now',
        'notify_title': 'Notification Center (3)',
        'watchlist_title': '⭐ My Watchlist Favorites',
        'watchlist_desc': 'Cryptocurrency assets added to your watch favorites',
        'watchlist_login_warning': '🔒 Please log in to load your watchlist',
        'academy_title': '🎓 Beginners Quant Academy',
        'academy_subtitle': 'Take you to play with AI Quant trading easily',
        'invite_title': 'Invite Friends',
        'invite_btn_invite_now': 'Invite',
        'invite_desc': 'Share AI wealth keys and earn double-sided follow cashback',
        'invite_rules': 'Copy your exclusive invite code and share it. When friend\'s first follow amount exceeds $100, both receive 10 USDT bonus!',
        'invite_btn_copy': 'Copy My Invite Code',
        'deposit_title': 'Fiat/Crypto Compliance Deposit',
        'deposit_desc': 'Support fiat and USDT multichain, AML audit compliance',
        'deposit_amount_lbl': 'Deposit Amount (USDT / equivalent)',
        'deposit_amount_placeholder': 'Min deposit 10 USDT or equivalent',
        'deposit_rate_tip': 'Select channel to view rate and expected credits',
        'deposit_channel_lbl': 'Select Channel (Crypto/Fiat Network)',
        'deposit_upload_lbl': 'Upload Payment Proof Screenshot',
        'deposit_upload_btn': 'Click to select or upload screenshot',
        'deposit_upload_desc': 'Support PNG, JPG, JPEG formats',
        'deposit_remit_lbl': 'AML Tracking Code (remittanceCode)',
        'deposit_submit': 'I have paid, submit request',
        'withdraw_title': 'Secure Fiat/Crypto Withdrawal',
        'withdraw_desc': 'Securely withdraw USDT to wallet or fiat, fast auditing',
        'withdraw_balance_lbl': 'Available Wallet Balance',
        'withdraw_amount_lbl': 'Withdrawal Amount (USDT)',
        'withdraw_amount_placeholder': 'Min withdrawal 10 USDT',
        'withdraw_method_lbl': 'Select Withdrawal Method',
        'withdraw_fee_lbl': 'Network Fee',
        'withdraw_net_lbl': 'Expected Receive Amount',
        'withdraw_submit': 'Confirm and Submit Withdrawal',
        'withdrawal_processing_tip': 'Instant withdrawals are processed through IMPS. If a withdrawal fails, please submit a new withdrawal request. We will attempt to process it again via IMPS. If IMPS is unavailable, the transaction will be processed through NEFT. NEFT transactions typically take up to 48 hours to complete.',
        'withdraw_crypto_tab': '🪙 Crypto',
        'withdraw_upi_tab': '⚡ UPI Fast',
        'withdraw_bank_tab': '🏦 Bank Card',
        '红杉神经网络量化': 'Sequoia Neural Quant',
        '红杉神经网络量化基于多层感知机模型进行日内高频调仓套利，适合中低风险偏好。': 'Sequoia Neural Quant executes intra-day high-frequency rebalancing arbitrage based on Multilayer Perceptron, suitable for medium-low risk appetite.',
        '摩根大通AI网格套利': 'JPMorgan AI Grid Arbitrage',
        '摩根大通AI网格套利利用阻力支撑网格算法在波动行情中自动锁利，稳健推荐。': 'JPMorgan AI Grid Arbitrage utilizes support-resistance grid algorithms to automatically lock profit in volatile markets, stable recommended.',
        'Transformer趋势跟踪': 'Transformer Trend Follow',
        'Transformer趋势跟踪采用自注意力机制识别大周期行情方向，稳定获取中长线复利。': 'Transformer Trend Follow adopts self-attention mechanisms to identify macro cycle trends, stably capturing mid-to-long term compound interest.',
        'XGBoost高频动量对冲': 'XGBoost High-Freq Hedging',
        'XGBoost高频动量对冲在极端行情下进行极速多空双向对冲套利，风险较高但收益极佳。': 'XGBoost High-Freq Hedging executes rapid long-short two-way hedging arbitrage under extreme market conditions, higher risk but excellent yields.',
        'auth_footer_note': '🔒 Secured with high-spec SIGN-SPEC-1.0 communication signature, immune to MITM exploits.',
        'invite_code_copied': '✓ Invite code AI88888 successfully copied to clipboard!',
        'notify_n1_title': '🎉 Quant Live Deposit Channel Activated',
        'notify_n1_body': 'The main fund gateway has been upgraded, copy trading minimum lowered to $50 USDT, fast building channel opened!',
        'notify_n1_time': '10 mins ago',
        'notify_n2_title': '🛡️ KYC Identity Double-Factor Encryption Upgraded',
        'notify_n2_body': 'AES-256 storage encryption has been deployed; no external risk control has access to user document keys.',
        'notify_n2_time': '2 hours ago',
        'notify_n3_title': '📈 AI Alpha Pro Strategy Surge Alert',
        'notify_n3_body': 'Past 30 days win rate broke 87.3%, today\'s quant cross-exchange arbitrage surplus has been fully distributed.',
        'notify_n3_time': '1 day ago',
        'academy_q1': 'What is AI Trading Smart Follow?',
        'academy_a1': 'AI Trading copy-follow is a brand-new wealth management service. By following elite AI quant strategies, the system automatically executes multi-factor asset management like high-frequency arbitrage and grid-trend trading on top exchanges for your account, capturing stable long-term premiums without you constantly monitoring market charts.',
        'academy_q2': 'Three Steps to Smart Follow:',
        'academy_step1': '<strong>Quick 1-Click Registration:</strong> Log in via SMS OTP, and the system automatically creates a secure trading account for you.',
        'academy_step2': '<strong>KYC Compliance Audit:</strong> To prevent global financial money laundering, we require basic identity documents for verification, unlocking high-frequency trading privileges.',
        'academy_step3': '<strong>Deploy Quant Strategies:</strong> Choose your desired plan in the lobby based on historical returns and drawdown performance, specify the amount, and click to start copy-following instantly!',
        'market_no_symbols': 'No cryptocurrency symbols available',
        'market_col_name': 'Symbol Name',
        'market_col_trend': 'Trend (24h)',
        'market_col_price': 'Last Price / Chg',
        'watchlist_empty': '🔒 No custom favorites added in your watchlist',
        'tx_loading': '🔄 Securely fetching your deposit/withdrawal transactions history...',
        'tx_type_fiat_dep': 'Fiat Deposit',
        'tx_type_crypto_dep': 'Crypto Deposit',
        'tx_type_withdraw': 'Funds Withdrawal',
        'tx_err_network': '⚠️ Network error occurred while fetching transactions list!',
        'tx_empty': '📭 No transaction records found in this category',
        'status_pending': 'Pending',
        'status_success': 'Success',
        'status_rejected': 'Rejected',
        'status_cancelled': 'Cancelled',
        'status_processing': 'Processing',
        'tx_detail_code': 'Tracking Code',
        'tx_detail_proof': 'Deposit Proof',
        'tx_detail_preview': 'Click to Preview 🔗',
        'tx_detail_channel': 'Recipient Account',
        'fund_loading': '🔄 Fetching account core balance transaction log ledger...',
        'fund_err_fail': '⚠️ Failed to fetch balance dynamic log details: ',
        'fund_err_network': '⚠️ Network error occurred while fetching fund ledger logs!',
        'fund_empty': '📭 No fund balance transaction logs found in this category',
        'fund_biz_dep_crypto': 'Crypto Deposit',
        'fund_biz_dep_fiat': 'Fiat Instant Deposit',
        'fund_biz_wd_crypto': 'Crypto Withdrawal Out',
        'fund_biz_wd_fiat': 'Bank Withdrawal Out',
        'fund_biz_quant': 'Deploy AI Quant Strategy',
        'fund_biz_quant_profit': 'Quant Cycle Profit Settle',
        'fund_biz_quant_refund': 'Strategy Expiration Refund',
        'fund_biz_copy_fee': 'Smart Copy Trade Service Fee',
        'fund_biz_transfer': 'Funds Internal Transfer',
        'fund_biz_settlement': 'Funds Cycle Settlement',
        'fund_lbl_id': 'Record ID',
        'fund_lbl_bal': 'Wallet Balance',
        'currency_switch_success': '💱 Valuation currency switched to: ',
        'currency_usdt_desc': 'USDT (Crypto Standard)',
        'currency_inr_desc': 'INR (Fiat Rupee)',
        'deposit_rate_tip_default': 'Please select deposit channel to view exchange rate and expected credits',
        'deposit_rate_tip_template': 'Current Rate: 1 <b>{symbol}</b> \u2248 <b>{rate} INR</b> (Expected Receive: <span class="green" style="font-weight: 700;">{converted} INR</span>)',
        'search_title': '🔍 Search Hub',
        'search_subtitle': 'Find quant strategies and hot crypto assets',
        'search_placeholder': 'Enter strategy name, model or coin symbol...',
        'search_hot_title': '🔥 Popular Searches',
        'search_strategy_section': '🤖 AI Quant Strategies',
        'search_market_section': '📊 Live Market Symbols',
        'search_no_results': '📭 No matching strategies or assets found',
        'search_click_to_follow': 'Click to follow & deploy',
        'search_click_to_trade': 'Click to view market trend',
        'profile_menu_withdraw_record': 'Withdrawal Record',
        'home_sec_promotion': 'Exclusive Offer 🎁',
        'home_cat_advisory': 'Advisory',
        'profile_menu_update': 'Software Update',
        'kyc_banner_btn': 'Continue',
        'profile_menu_network': 'Network Line Set',
        'home_cat_stocks': 'Stocks',
        'auth_invite_lbl': 'Referral Code (Optional)',
        'profile_menu_more': 'More Settings',
        'profile_menu_security': 'Account Security',
        'home_promo_claim': 'Claim Now',
        'home_promo_invite_btn': 'Invite Now',
        'profile_success_invited_friends': 'Success invited friends',
        'home_cat_crypto': 'Crypto',
        'market_cat_watchlist': 'Watchlist',
        'home_trending_gainers': 'Gainers',
        'home_promo_invite_friends': 'Invite Friends',
        'kyc_banner_title': 'Identity Verification',
        'profile_menu_recharge_record': 'Recharge Record',
        'home_search_script': 'Search for a scrip',
        'kyc_banner_desc': 'Complete identity verification to start trading',
        'market_cat_cap': 'Market Cap',
        'home_sec_trending': 'Trending Assets',
        'home_cat_fd': 'Fixed Income',
        'profile_menu_ledgers': 'Fund Ledgers',
        'invite_welcome_invited_by': '🌟 Invited by: ',
        'profile_menu_payment': 'Payment Account',
        'home_promo_referral': 'Referral Cashback',
        'market_cat_volume': 'Quote Volume',
        'home_trending_losers': 'Losers',
        'home_promo_discounted': 'Limited Time Bonus',
        'market_cat_sector': 'Industry Sector',
        'market_cat_stock_gainers': 'Stock Gainers',
        'market_cat_stock_losers': 'Stock Losers',
        'market_cat_stock_turnover': 'Stock Turnover',
        'profile_avail_trade_lbl': 'Available to trade',
        'follow_toast_sort_adapted': 'Smart sorting automatically adapted to the highest win rate option',
        'detail_order_no_prefix': 'Order No: ',
        'drawer_title_details': 'Quant Follow Details',
        'details_lbl_status': 'Current Follow Status',
        'details_sec_execution': '📈 Intelligent Quant Trade Details',
        'details_lbl_buy_price': 'Entry Buy Price',
        'details_lbl_sell_price': 'Exit Sell Price',
        'details_lbl_total_profit': 'Total Follow Profits',
        'details_lbl_roi': 'Quant Return on Investment (ROI)',
        'details_btn_close': 'I Understand',
        'invite_lbl_inviter': 'My Inviter',
        'invite_status_bound': 'Secured Bound',
        'invite_lbl_bind': '🔗 Bind Your Inviter (Optional)',
        'invite_btn_verify': 'Verify',
        'invite_btn_confirm': 'Confirm',
        'invite_lbl_my_referrals': '👥 Successfully Invited Friends',
        'invite_loading_referrals': '🔄 Fetching your invited friends list...',
        'loading_home_trending': '🔄 Syncing real-time market feeds...',
        'withdraw_bank_ifsc_placeholder': 'e.g. HDFC0001234',
        'ledgers_header_title': '💵 Account Ledgers',
        'filter_deposit': 'Deposit',
        'filter_withdraw': 'Withdraw',
        'invite_count_unit': ' friends',
        'deposit_bank_name': 'Recipient Bank Name',
        'withdraw_bank_acc_lbl': 'Bank Account Number (Account Number)',
        'records_header_desc': 'Query all recharge and withdrawal records under this account',
        'deposit_beneficiary_name': 'Recipient Account Name (Beneficiary)',
        'deposit_receiving_addr_lbl': 'Receiving Wallet Address (USDT Only)',
        'withdraw_upi_addr_placeholder': 'e.g. jackson@oksbi',
        'records_header_title': '📊 Transaction History',
        'withdraw_crypto_addr_placeholder': 'Enter your TRC20 wallet address',
        'withdraw_bank_acc_placeholder': 'Enter your bank account number',
        'withdraw_bank_name_lbl': 'Recipient Bank Name (Bank Name)',
        'withdraw_bank_ifsc_lbl': 'Bank IFSC / Swift Code (IFSC/Swift Code)',
        'deposit_channel_default': 'TRON Network',
        'copy_btn': 'Copy',
        'withdraw_upi_addr_lbl': 'UPI Receiving Account (VPA)',
        'deposit_swift_code': 'SWIFT Code',
        'filter_strategy': 'Strategy',
        'ledgers_header_desc': 'Query all balance changes and settlement billing log details',
        'deposit_account_number': 'Recipient Account Number',
        'withdraw_crypto_addr_lbl': 'USDT TRC20 Receiving Address',
        'withdraw_bank_name_placeholder': 'e.g. DBS Bank or HDFC',
        'invite_lbl_inviter_preview': '🔍 Inviter: ',
        'deposit_channel_title': 'Deposit Channel',
        'withdraw_channel_title': 'Withdraw Channel',
        'back_btn': 'Back',
        'invite_err_login_required': '🔒 Please log in to view your invited friends list',
        'invite_empty_title': 'No invited friends yet',
        'invite_empty_desc': 'Go share your exclusive referral code to earn bonuses!',
        'invite_register_prefix': 'Reg: ',
        'invite_status_enabled': 'Active',
        'invite_status_disabled': 'Frozen',
        'invite_err_fetch_failed': '⚠️ Failed to fetch list:',
        'invite_err_network': '⚠️ Network error, unable to fetch list',
        'invite_verify_success': '✓ Referrer verification successful, please click to confirm binding!',
        'invite_verify_fail': '❌ Referrer ID verification failed, user does not exist!',
        'invite_verify_error': '❌ Referrer info verification failed',
        'invite_bind_submitting': 'Submitting referrer binding...',
        'invite_bind_success': '✓ Referrer binding successful!',
        'invite_bind_fail': '❌ Referrer binding failed!',
        'invite_bind_error': '❌ Network request exception',
        'invite_unit_people': ' friends',
        'profile_menu_download': 'Download APP',
        'download_title': 'Download APP',
        'download_desc': 'Select your mobile device platform',
        'payment_modal_title': 'Set payment account',
        'payment_personal_info': 'Personal Information',
        'payment_lbl_name': 'Name',
        'payment_lbl_phone': 'Phone',
        'payment_binding_info': 'Account binding information',
        'payment_btn_edit': 'Edit',
        'payment_not_bound': 'Not bound',
        'payment_header_edit_upi': 'Edit UPI',
        'payment_placeholder_upi': 'Enter UPI VPA (e.g. jackson@oksbi)',
        'payment_btn_cancel': 'Cancel',
        'payment_btn_save': 'Save',
        'payment_bank_card': 'Bank card',
        'payment_lbl_bank_name': 'Bank name',
        'payment_lbl_bank_account': 'Bank account',
        'payment_lbl_ifsc': 'IFSC',
        'payment_header_edit_bank': 'Edit Bank Card',
        'payment_placeholder_bank_name': 'Bank Name (e.g. DBS Bank)',
        'payment_placeholder_bank_account': 'Bank Account Number',
        'payment_placeholder_ifsc': 'IFSC Code (e.g. HDFC0001234)',
        'payment_crypto_account': 'Crypto Account',
        'payment_lbl_network': 'Network',
        'payment_lbl_address': 'Address',
        'payment_lbl_memo': 'Memo',
        'payment_header_edit_crypto': 'Edit Crypto Account',
        'payment_placeholder_crypto': 'Enter TRC20 Wallet Address',
        'payment_hint_safe': 'Please keep your payment account details safe and correct.',
        'toast_online_support_prep': '🎧 Online customer support line is preparing, please try again later!',
    },
    'hi': {
        'nav_home': 'मुख्यपृष्ठ',
        'nav_market': 'बाजार',
        'nav_follow': 'फ़ॉलो करें',
        'nav_assets': 'संपत्ति',
        'nav_profile': 'प्रोफ़ाइल',
        'home_title': 'एआई रणनीति का पालन करें',
        'home_subtitle': 'स्मार्ट ट्रेडिंग, आसान मुनाफा',
        'home_desc': 'एआई को आपके लिए व्यापार करने दें और लाभ का आनंद लें',
        'home_cta': 'फ़ॉलो करना शुरू करें <span class="btn-arrow">→</span>',
        'home_guest_title': 'आप वर्तमान में लॉग इन नहीं हैं',
        'home_guest_desc': 'अपना प्रोफ़ाइल सुरक्षित करने और एआई कॉपी ट्रेडिंग शुरू करने के लिए अभी लॉग इन करें',
        'home_guest_btn': 'सुरक्षित लॉगिन',
        'quick_ai_strategy': 'एआई रणनीति',
        'quick_follow_leaderboard': 'लीडरबोर्ड',
        'quick_academy': 'अकादमी',
        'quick_invite': 'आमंत्रित करें',
        'section_market_overview': 'बाजार का अवलोकन',
        'section_featured_strategies': '🔥 चुनिंदा एआई रणनीतियाँ',
        'section_live_profits': '📢 लाइव फ़ॉलो मुनाफा',
        'section_more': 'अधिक ›',
        'loading_featured': 'चुनिंदा रणनीतियों को लोड किया जा रहा है...',
        'home_ticker_followed': 'ने फ़ॉलो किया',
        'home_ticker_just_now': 'अभी-अभी',
        'home_ticker_1min_ago': '1 मिनट पहले',
        'market_title': 'बाजार घड़ी',
        'loading_market_list': 'लाइव बाजार फ़ीड प्राप्त किए जा रहे हैं...',
        'market_back_to_market': 'बाजार पर वापस जाएं',
        'market_h24': '24 घंटे उच्च',
        'market_l24': '24 घंटे निम्न',
        'market_chart_title': '1एम लाइव ट्रेंड कैंडलस्टिक चार्ट',
        'market_depth_title': 'ऑर्डर बुक',
        'market_depth_price': 'कीमत',
        'market_depth_qty': 'मात्रा',
        'market_trades_title': 'हाल के ट्रेड',
        'market_trades_time': 'समय',
        'follow_title': 'एआई क्वांट रणनीतियाँ',
        'filter_all': 'सभी',
        'filter_stable': 'स्थिर',
        'filter_high': 'उच्च उपज',
        'filter_short': 'अल्पकालिक',
        'loading_strategies': 'सर्वर क्वांट रणनीतियाँ प्राप्त की जा रही हैं...',
        'assets_title': 'मेरे फ़ॉलो',
        'assets_total_invest_lbl': 'कुल निवेश (USDT)',
        'assets_total_profit_lbl': 'कुल मुनाफा (USDT)',
        'assets_deposit_btn': 'जमा धन (फिएट/क्रिप्टो)',
        'assets_withdraw_btn': 'निकासी धन (यूपीआई/बैंक)',
        'assets_tab_active': 'सक्रिय',
        'assets_tab_history': 'इतिहास',
        'assets_tab_stopped': 'रोका गया',
        'assets_login_warning': 'कृपया अपने क्वांट ऑर्डर लोड करने के लिए लॉग इन करें',
        'profile_nickname_guest': 'अतिथि (लॉग इन नहीं)',
        'profile_total_assets_lbl': 'कुल संपत्ति (USDT)',
        'profile_today_profit_lbl': 'आज का लाभ',
        'profile_deposit': 'जमा',
        'profile_withdraw': 'निकासी',
        'profile_txrecords': 'लेन-देन',
        'profile_funddetails': 'पूंजी विवरण',
        'profile_menu_my_follow': 'मेरी फ़ॉलो स्थितियां',
        'profile_menu_my_watchlist': 'मेरी निगरानी सूची',
        'profile_menu_invite': 'मित्रों को आमंत्रित करें',
        'profile_menu_invite_badge': 'पुरस्कार अर्जित करें',
        'profile_menu_academy': 'शुरुआतीअकादमी',
        'profile_menu_help': 'सहायता केंद्र',
        'profile_menu_lang': 'भाषा सेटिंग्स (Language)',
        'profile_menu_kyc': 'केवाईसी सत्यापन',
        'profile_kyc_unverified': 'असत्यापित',
        'profile_logout_btn': 'सुरक्षित साइन आउट',
        'drawer_title_model': 'मॉडल चयन',
        'drawer_title_risk': 'जोखिम स्तर',
        'drawer_risk_low': 'कम',
        'drawer_risk_medium': 'मध्यम',
        'drawer_risk_high': 'उच्च',
        'drawer_title_stoploss': 'स्टॉप लॉस',
        'drawer_avail_balance': 'उपलब्ध शेष राशि',
        'drawer_add_funds': 'धन जोड़ें',
        'drawer_agree_terms': 'मैंने <a href="javascript:void(0)" onclick="openPlatformAgreementModal(\'advisory-agree\', event)" style="color: var(--primary); text-decoration: underline;">कॉपी ट्रेडिंग सेवा समझौते</a> को पढ़ा है और उससे सहमत हूं',
        'drawer_agree_terms_short': 'मैं <a href="javascript:void(0)" onclick="openPlatformAgreementModal(\'advisory-agree\', event)" style="color: #1534B9; text-decoration: underline; font-weight: 700;">एआई ट्रेडिंग जोखिम पावती</a> से सहमत हूँ',
        'drawer_submit_btn': 'समीक्षा करें',
        'success_title': 'ऑर्डर सफलतापूर्वक सबमिट किया गया',
        'success_subtitle': 'कृपया सिस्टम ऑडिट सत्यापन की प्रतीक्षा करें',
        'success_lbl_order_id': 'क्वांट फ़ॉलो आईडी',
        'success_lbl_amount': 'निवेशित संपत्ति',
        'success_lbl_stoploss': 'अधिकतम स्टॉप लॉस दर',
        'success_lbl_time': 'तैनाती का समय',
        'success_btn_positions': 'स्थितियों का विवरण',
        'success_btn_home': 'लॉबी पर वापस जाएं',
        'kyc_title': 'केवाईसी अनुपालन वास्तविक नाम सत्यापन',
        'kyc_desc': 'पूर्ण एआई ट्रेडिंग विशेषाधिकारों को सक्रिय करने के लिए वास्तविक नाम पहचान जानकारी जमा करें',
        'kyc_name_lbl': 'वास्तविक नाम',
        'kyc_name_placeholder': 'आईडी दस्तावेज़ के अनुसार पूरा नाम दर्ज करें',
        'kyc_type_lbl': 'आईडी दस्तावेज़ का प्रकार',
        'kyc_number_lbl': 'दस्तावेज़ संख्या',
        'kyc_number_placeholder': 'आईडी दस्तावेज़ संख्या दर्ज करें',
        'kyc_privacy': '🔒 मनी लॉन्ड्रिंग विरोधी ऑडिट के लिए केवल स्थानीय रूप से एईएस -256 के माध्यम से संवेदनशील डेटा एन्क्रिप्ट किया गया है।',
        'kyc_submit': 'केवाईसी आवेदन जमा करें',
        'auth_title': 'एआई ट्रेडिंग त्वरित लॉगिन',
        'auth_desc': 'त्वरित सुरक्षित पंजीकरण के लिए एसएमएस के माध्यम से वन-क्लिक ओटीपी',
        'auth_phone_lbl': 'मोबाइल फोन नंबर',
        'auth_phone_placeholder': '',
        'auth_code_lbl': 'एसएमएस सत्यापन कोड (ओटीपी)',
        'auth_code_placeholder': '6-अंकीय ओटीपी कोड दर्ज करें',
        'auth_btn_send_otp': 'ओटीपी भेजें',
        'auth_btn_submit': 'लॉग इन करें / अभी पंजीकरण करें',
        'notify_title': 'संदेश अधिसूचना केंद्र',
        'watchlist_title': '⭐ मेरी पसंदीदा निगरानी सूची',
        'watchlist_desc': 'क्रिप्टोक्यूरेंसी परिसंपत्तियों को आपकी घड़ी की प्राथमिकताओं में जोड़ा गया',
        'watchlist_login_warning': '🔒 कृपया अपनी निगरानी सूची लोड करने के लिए लॉग इन करें',
        'academy_title': '🎓 शुरुआती क्वांट अकादमी',
        'academy_subtitle': 'एआई क्वांट ट्रेडिंग के साथ आसानी से खेलें',
        'invite_title': 'मित्रों को आमंत्रित करें',
        'invite_btn_invite_now': 'आमंत्रित करें',
        'invite_desc': 'एआई वेल्थ चाबियां साझा करें और दो तरफा कैशबैक अर्जित करें',
        'invite_rules': 'अपना विशिष्ट आमंत्रण कोड कॉपी करें। जब मित्र की पहली फ़ॉलो राशि $100 से अधिक हो जाती है, तो दोनों को 10 USDT का बोनस प्राप्त होता है!',
        'invite_btn_copy': 'मेरा आमंत्रण कोड कॉपी करें',
        'deposit_title': 'फिएट/क्रिप्टो अनुपालन जमा',
        'deposit_desc': 'फिएट और यूपीआई/क्रिप्टो का समर्थन, मनी लॉन्ड्रिंग विरोधी अनुपालन',
        'deposit_amount_lbl': 'जमा राशि (यूएसडीटी / समकक्ष)',
        'deposit_amount_placeholder': 'न्यूनतम जमा 10 यूएसडीटी या समकक्ष',
        'deposit_rate_tip': 'दर और अपेक्षित क्रेडिट देखने के लिए चैनल का चयन करें',
        'deposit_channel_lbl': 'चैनल का चयन करें (क्रिप्टो/फिएट नेटवर्क)',
        'deposit_upload_lbl': 'भुगतान प्रमाण स्क्रीनशॉट अपलोड करें',
        'deposit_upload_btn': 'चयन करने या स्क्रीनशॉट अपलोड करने के लिए क्लिक करें',
        'deposit_upload_desc': 'पीएनजी, जेपीजी, जेपीईजी प्रारूपों का समर्थन',
        'deposit_remit_lbl': 'एएमएल ट्रैकिंग कोड (प्रेषण कोड)',
        'deposit_submit': 'मैंने भुगतान कर दिया है, अनुरोध सबमिट करें',
        'withdraw_title': 'सुरक्षित फिएट/क्रिप्टो निकासी',
        'withdraw_desc': 'वॉलेट या फिएट में यूएसडीटी को सुरक्षित रूप से वापस लें, तेज़ ऑडिटिंग',
        'withdraw_balance_lbl': 'उपलब्ध वॉलेट शेष राशि',
        'withdraw_amount_lbl': 'निकासी राशि (यूएसडीटी)',
        'withdraw_amount_placeholder': 'न्यूनतम निकासी 10 यूएसडीटी',
        'withdraw_method_lbl': 'निकासी विधि का चयन करें',
        'withdraw_fee_lbl': 'नेटवर्क शुल्क',
        'withdraw_net_lbl': 'अपेक्षित प्राप्त राशि',
        'withdraw_submit': 'पुष्टि करें और निकासी सबमिट करें',
        'withdrawal_processing_tip': 'IMPS \u0915\u0947 \u092E\u093E\u0927\u094D\u092F\u092E \u0938\u0947 \u0924\u094D\u0935\u0930\u093F\u0924 \u0928\u093F\u0915\u093E\u0938\u0940 \u0915\u0940 \u092A\u094D\u0930\u0915\u094D\u0930\u093F\u092F\u093E \u0915\u0940 \u091C\u093E\u0924\u0940 \u0939\u0948\u0964 \u092F\u0926\u093F \u0915\u094B\u0908 \u0928\u093F\u0915\u093E\u0938\u0940 \u0935\u093F\u092B\u0932 \u0939\u094B \u091C\u093E\u0924\u0940 \u0939\u0948, \u0924\u094B \u0915\u0943\u092A\u092F\u093E \u090F\u0915 \u0928\u092F\u093E \u0928\u093F\u0915\u093E\u0938\u0940 \u0905\u0928\u0941\u0930\u094B\u0927 \u092A\u094D\u0930\u0938\u094D\u0924\u0941\u0924 \u0915\u0930\u0947\u0902\u0964 \u0939\u092E IMPS \u0915\u0947 \u092E\u093E\u0927\u094D\u092F\u092E \u0938\u0947 \u0907\u0938\u0947 \u092B\u093F\u0930 \u0938\u0947 \u0938\u0902\u0938\u093E\u0927\u093F\u0924 \u0915\u0930\u0928\u0947 \u0915\u093E \u092A\u094D\u0930\u092F\u093E\u0938 \u0915\u0930\u0947\u0902\u0917\u0947\u0964 \u092F\u0926\u093F IMPS \u0905\u0928\u0941\u092A\u0932\u092C\u094D\u0927 \u0939\u0948, \u0924\u094B \u0932\u0947\u0928\u0926\u0947\u0928 \u0915\u094B NEFT \u0915\u0947 \u092E\u093E\u0927\u094D\u092F\u092E \u0938\u0947 \u0938\u0902\u0938\u093E\u0927\u093F\u0924 \u0915\u093F\u092F\u093E \u091C\u093E\u090F\u0917\u093E\u0964 NEFT \u0932\u0947\u0928\u0926\u0947\u0928 \u0915\u094B \u092A\u0942\u0930\u093E \u0939\u094B\u0928\u0947 \u092E\u0947\u0902 \u0906\u092E\u0924\u094C\u0930 \u092A\u0930 48 \u0918\u0902\u091F\u0947 \u0924\u0915 \u0915\u093E \u0938\u092E\u092F \u0932\u0917\u0924\u093E \u0939\u0948\u0964',
        'withdraw_crypto_tab': '🪙 क्रिप्टो',
        'withdraw_upi_tab': '⚡ यूपीआई फास्ट',
        'withdraw_bank_tab': '🏦 बैंक कार्ड',
        '红杉神经网络量化': 'सेक्विया न्यूरल क्वांट',
        '红杉神经网络量化基于多层感知机模型进行日内高频调仓套利，适合中低风险偏好。': 'सेक्विया न्यूरल क्वांट मल्टीलेयर परसेप्ट्रॉन पर आधारित इंट्रा-डे हाई-फ्रीक्वेंसी रीबैलेंसिंग आर्बिट्राज निष्पादित करता है, जो मध्यम-निम्न जोखिम के लिए उपयुक्त है।',
        '摩根大通AI网格套利': 'जेपीमॉर्गन एआई ग्रिड आर्बिट्राज',
        '摩根大通AI网格套利利用阻力支撑网格算法在波动行情中自动锁利，稳健推荐。': 'जेपीमॉर्गन एआई ग्रिड आर्बिट्राज अस्थिर बाजारों में स्वचालित रूप से लाभ लॉक करने के लिए समर्थन-प्रतिरोध ग्रिड एल्गोरिदम का उपयोग करता है, स्थिर अनुशंसित।',
        'Transformer趋势跟踪': 'ट्रांसफॉर्मर ट्रेंड फ़ॉलो',
        'Transformer趋势跟踪采用自注意力机制识别大周期行情方向，稳定获取中长线复利。': 'ट्रांसफॉर्मर ट्रेंड फ़ॉलो मैक्रो चक्र प्रवृत्तियों की पहचान करने के लिए स्वयं-ध्यान तंत्र को अपनाता है, जो मध्यम से दीर्घकालिक चक्रवात ब्याज को स्थिर रूप से कैप्चर करता है।',
        'XGBoost高频动量对冲': 'एक्सजीबूस्ट हाई-फ्रीक्वेंसी हेजिंग',
        'XGBoost高频动量对冲在极端行情下进行极速多空双向对冲套利，风险较高但收益极佳。': 'एक्सजीबूस्ट हाई-फ्रीक्वेंसी हेजिंग चरम बाजार स्थितियों के तहत तेजी से लॉन्ग-शॉर्ट टू-वे हेजिंग आर्बिट्राज निष्पादित करता है, उच्च जोखिम लेकिन उत्कृष्ट उपज।',
        'auth_footer_note': '🔒 उच्च-विशिष्ट SIGN-SPEC-1.0 संचार हस्ताक्षर के साथ सुरक्षित, MITM हमलों से पूरी तरह सुरक्षित।',
        'invite_code_copied': '✓ आमंत्रण कोड AI88888 सफलतापूर्वक क्लिपबोर्ड पर कॉपी किया गया!',
        'notify_n1_title': '🎉 क्वांट लाइव डिपॉजिट चैनल सफलतापूर्वक सक्रिय',
        'notify_n1_body': 'मुख्य फंड गेटवे को अपग्रेड किया गया है, कॉपी ट्रेडिंग न्यूनतम सीमा घटाकर $50 USDT कर दी गई है, तेज़ट्रेडिंगचैनल खुला!',
        'notify_n1_time': '10 मिनट पहले',
        'notify_n2_title': '🛡️ केवाईसी पहचान दो-कारक एन्क्रिप्शन अपग्रेड किया गया',
        'notify_n2_body': 'AES-256 स्टोरेज एन्क्रिप्शन तैनात किया गया है; किसी भी बाहरी जोखिम नियंत्रण के पास उपयोगकर्ता के दस्तावेज़ कुंजियों तक पहुंच नहीं है।',
        'notify_n2_time': '2 घंटे पहले',
        'notify_n3_title': '📈 एआई अल्फा प्रो रणनीति उछाल चेतावनी',
        'notify_n3_body': 'पिछले 30 दिनों में जीत की दर 87.3% को पार कर गई, आज का क्वांट क्रॉस-एक्सचेंज आर्बिट्राज अधिशेष पूरी तरह से वितरित किया गया।',
        'notify_n3_time': '1 दिन पहले',
        'academy_q1': 'एआई ट्रेडिंग स्मार्ट फ़ॉलो क्या है?',
        'academy_a1': 'एआई ट्रेडिंग कॉपी-फ़ॉलो एक बिल्कुल नई धन प्रबंधन सेवा है। विशिष्ट एआई क्वांट रणनीतियों का पालन करके, सिस्टम आपके खाते के लिए शीर्ष एक्सचेंजों पर उच्च-आवृत्ति आर्बिट्राज और ग्रिड-ट्रेंड ट्रेडिंग जैसे मल्टी-फैक्टर परिसंपत्ति प्रबंधन को स्वचालित रूप से निष्पादित करता है, जिससे आप लगातार बाजार चार्ट की निगरानी किए बिना स्थिर दीर्घकालिक प्रीमियम प्राप्त कर सकते हैं।',
        'academy_q2': 'स्मार्ट फ़ॉलो के लिए तीन चरण:',
        'academy_step1': '<strong>त्वरित 1-क्लिक पंजीकरण:</strong> एसएमएस ओटीपी के माध्यम से लॉग इन करें, और सिस्टम स्वचालित रूप से आपके लिए एक सुरक्षित ट्रेडिंग खाता बनाता है।',
        'academy_step2': '<strong>केवाईसी अनुपालन ऑडिट:</strong> वैश्विक वित्तीय मनी लॉन्ड्रिंग को रोकने के लिए, हमें सत्यापन के लिए बुनियादी पहचान दस्तावेजों की आवश्यकता होती, जिससे उच्च-आवृत्ति व्यापार विशेषाधिकार अनलॉक होते हैं।',
        'academy_step3': '<strong>क्वांट रणनीतियों को तैनात करें:</strong> ऐतिहासिक रिटर्न और गिरावट के प्रदर्शन के आधार पर लॉबी में अपनी वांछित योजना चुनें, राशि निर्दिष्ट करें, और तुरंत कॉपी-फ़ॉलो करना शुरू करने के लिए क्लिक करें!',
        'market_no_symbols': 'कोई क्रिप्टोक्यूरेंसी प्रतीक उपलब्ध नहीं है',
        'market_col_name': 'प्रतीक नाम',
        'market_col_trend': 'रुझान (24 घंटे)',
        'market_col_price': 'नवीनतम मूल्य / परिवर्तन',
        'watchlist_empty': '🔒 आपकी निगरानी सूची में कोई पसंदीदा नहीं जोड़ा गया',
        'tx_loading': '🔄 आपके जमा/निकासी लेनदेन इतिहास को सुरक्षित रूप से पुनर्प्राप्त किया जा रहा है...',
        'tx_type_fiat_dep': 'फिएट जमा',
        'tx_type_crypto_dep': 'क्रिप्टो जमा',
        'tx_type_withdraw': 'धन निकासी',
        'tx_err_network': '⚠️ लेनदेन सूची प्राप्त करते समय नेटवर्क त्रुटि हुई!',
        'tx_empty': '📭 इस श्रेणी में कोई लेनदेन रिकॉर्ड नहीं मिला',
        'status_pending': 'लंबित',
        'status_success': 'सफल',
        'status_rejected': 'अस्वीकृत',
        'status_cancelled': 'रद्द',
        'status_processing': 'प्रसंस्करण',
        'tx_detail_code': 'ट्रैकिंग कोड',
        'tx_detail_proof': 'जमा प्रमाण',
        'tx_detail_preview': 'पूर्वावलोकन के लिए क्लिक करें 🔗',
        'tx_detail_channel': 'प्राप्तकर्ता खाता',
        'fund_loading': '🔄 खाता कोर बैलेंस लेनदेन लॉग बही प्राप्त किया जा रहा है...',
        'fund_err_fail': '⚠️ बैलेंस डायनेमिक लॉग विवरण प्राप्त करने में विफल: ',
        'fund_err_network': '⚠️ फंड बही लॉग प्राप्त करते समय नेटवर्क त्रुटि हुई!',
        'fund_empty': '📭 इस श्रेणी में कोई फंड बैलेंस लेनदेन लॉग नहीं मिला',
        'fund_biz_dep_crypto': 'क्रिप्टो जमा',
        'fund_biz_dep_fiat': 'फिएट तत्काल जमा',
        'fund_biz_wd_crypto': 'क्रिप्टो निकासी बाहर',
        'fund_biz_wd_fiat': 'बैंक निकासी बाहर',
        'fund_biz_quant': 'एआई क्वांट रणनीति तैनात करें',
        'fund_biz_quant_profit': 'क्वांट चक्र लाभ निपटान',
        'fund_biz_quant_refund': 'रणनीति समाप्ति वापसी',
        'fund_biz_copy_fee': 'स्मार्ट कॉपी ट्रेड सेवा शुल्क',
        'fund_biz_transfer': 'फंड आंतरिक हस्तांतरण',
        'fund_biz_settlement': 'फंड चक्र निपटान',
        'fund_lbl_id': 'रिकॉर्ड आईडी',
        'fund_lbl_bal': 'बैलेंस',
        'currency_switch_success': '💱 मूल्यांकन मुद्रा को इसमें स्विच किया गया: ',
        'currency_usdt_desc': 'USDT (क्रिप्टो मानक)',
        'currency_inr_desc': 'INR (फिएट रुपया)',
        'deposit_rate_tip_default': 'विनिमय दर और अपेक्षित क्रेडिट देखने के लिए कृपया जमा चैनल का चयन करें',
        'deposit_rate_tip_template': 'वर्तमान दर: 1 <b>{symbol}</b> \u2248 <b>{rate} INR</b> (अपेक्षित प्राप्त: <span class="green" style="font-weight: 700;">{converted} INR</span>)',
        'search_title': '🔍 खोज हब',
        'search_subtitle': 'क्वांट रणनीतियों और गर्म क्रिप्टो परिसंपत्तियों को ढूंढें',
        'search_placeholder': 'रणनीति का नाम, मॉडल या सिक्का प्रतीक दर्ज करें...',
        'search_hot_title': '🔥 लोकप्रिय खोजें',
        'search_strategy_section': '🤖 एआई क्वांट रणनीतियाँ',
        'search_market_section': '📊 लाइव बाजार प्रतीक',
        'search_no_results': '📭 कोई मिलान रणनीति या संपत्ति नहीं मिली',
        'search_click_to_follow': 'अनुसरण और तैनात करने के लिए क्लिक करें',
        'search_click_to_trade': 'बाजार का रुझान देखने के लिए क्लिक करें',
        'profile_menu_withdraw_record': 'निकासी रिकॉर्ड',
        'home_sec_promotion': 'विशेष ऑफर 🎁',
        'home_cat_advisory': 'सलाहकार',
        'profile_menu_update': 'सॉफ़्टवेयर अपडेट',
        'kyc_banner_btn': 'जारी रखें',
        'profile_menu_network': 'नेटवर्क लाइन सेट करें',
        'home_cat_stocks': 'शेयर',
        'auth_invite_lbl': 'रेफ़रल कोड (वैकल्पिक)',
        'profile_menu_more': 'अधिक सेटिंग्स',
        'profile_menu_security': 'खाता सुरक्षा',
        'home_promo_claim': 'अभी दावा करें',
        'home_promo_invite_btn': 'अभी आमंत्रित करें',
        'profile_success_invited_friends': 'सफलतापूर्वक आमंत्रित मित्र',
        'home_cat_crypto': 'क्रिप्टो',
        'market_cat_watchlist': 'निगरानी सूची',
        'home_trending_gainers': 'बढ़ने वाले',
        'home_promo_invite_friends': 'मित्रों को आमंत्रित करें',
        'kyc_banner_title': 'पहचान सत्यापन',
        'profile_menu_recharge_record': 'रिचार्ज रिकॉर्ड',
        'home_search_script': 'एक स्क्रिप्ट खोजें',
        'kyc_banner_desc': 'प्रतिलिपि व्यापार शुरू करने के लिए पहचान सत्यापन पूरा करें',
        'market_cat_cap': 'मार्केट कैप',
        'home_sec_trending': 'रुझान वाली संपत्तियां',
        'home_cat_fd': 'निश्चित आय',
        'profile_menu_ledgers': 'फंड लेजर',
        'invite_welcome_invited_by': '🌟 द्वारा आमंत्रित: ',
        'profile_menu_payment': 'भुगतान खाता',
        'home_promo_referral': 'रेफ़रल कैशबैक',
        'market_cat_volume': 'उद्धरण मात्रा',
        'home_trending_losers': 'गिरने वाले',
        'home_promo_discounted': 'सीमित समय बोनस',
        'market_cat_sector': 'उद्योग क्षेत्र',
        'market_cat_stock_gainers': 'स्टॉक बढ़ने वाले',
        'market_cat_stock_losers': 'स्टॉक गिरने वाले',
        'market_cat_stock_turnover': 'स्टॉक टर्नओवर',
        'profile_avail_trade_lbl': 'व्यापार के लिए उपलब्ध',
        'follow_toast_sort_adapted': 'स्मार्ट सॉर्टिंग स्वचालित रूप से उच्चतम जीत दर विकल्प के अनुकूल हो गई',
        'detail_order_no_prefix': 'ऑर्डर संख्या: ',
        'drawer_title_details': 'क्वांट फॉलो विवरण',
        'details_lbl_status': 'वर्तमान फॉलो स्थिति',
        'details_sec_execution': '📈 इंटेलिजेंट क्वांट ट्रेड विवरण',
        'details_lbl_buy_price': 'प्रविष्टि खरीद मूल्य',
        'details_lbl_sell_price': 'निकास बिक्री मूल्य',
        'details_lbl_total_profit': 'कुल फॉलो लाभ',
        'details_lbl_roi': 'क्वांट निवेश पर रिटर्न (ROI)',
        'details_btn_close': 'मैं समझता हूँ',
        'invite_lbl_inviter': 'मेरा आमंत्रितकर्ता',
        'invite_status_bound': 'सुरक्षित रूप से बाध्य',
        'invite_lbl_bind': '🔗 अपने आमंत्रितकर्ता को बाध्य करें (वैकल्पिक)',
        'invite_btn_verify': 'सत्यापित करें',
        'invite_btn_confirm': 'पुष्टि करें',
        'invite_lbl_my_referrals': '👥 सफलतापूर्वक आमंत्रित मित्र',
        'invite_loading_referrals': '🔄 आपकी आमंत्रित मित्रों की सूची प्राप्त की जा रही है...',
        'loading_home_trending': '🔄 रीयल-टाइम मार्केट फ़ीड को सिंक किया जा रहा है...',
        'withdraw_bank_ifsc_placeholder': 'उदा. HDFC0001234',
        'ledgers_header_title': '💵 खाता बही',
        'filter_deposit': 'जमा',
        'filter_withdraw': 'निकासी',
        'invite_count_unit': ' मित्र',
        'deposit_bank_name': 'प्राप्तकर्ता बैंक का नाम',
        'withdraw_bank_acc_lbl': 'बैंक खाता संख्या (खाता संख्या)',
        'records_header_desc': 'इस खाते के तहत सभी रिचार्ज और निकासी रिकॉर्ड की जांच करें',
        'deposit_beneficiary_name': 'प्राप्तकर्ता खाते का नाम (लाभार्थी)',
        'deposit_receiving_addr_lbl': 'प्राप्तकर्ता वॉलेट पता (केवल USDT)',
        'withdraw_upi_addr_placeholder': 'उदा. jackson@oksbi',
        'records_header_title': '📊 लेनदेन इतिहास',
        'withdraw_crypto_addr_placeholder': 'अपना TRC20 वॉलेट पता दर्ज करें',
        'withdraw_bank_acc_placeholder': 'अपनी बैंक खाता संख्या दर्ज करें',
        'withdraw_bank_name_lbl': 'प्राप्तकर्ता बैंक का नाम (बैंक का नाम)',
        'withdraw_bank_ifsc_lbl': 'बैंक IFSC / स्विफ्ट कोड (IFSC/स्विफ्ट कोड)',
        'deposit_channel_default': 'TRON नेटवर्क',
        'copy_btn': 'कॉपी',
        'withdraw_upi_addr_lbl': 'UPI प्राप्तकर्ता खाता (VPA)',
        'deposit_swift_code': 'स्विफ्ट कोड',
        'filter_strategy': 'रणनीति',
        'ledgers_header_desc': 'सभी शेष राशि परिवर्तनों और निपटान बिलिंग लॉग विवरण की जांच करें',
        'deposit_account_number': 'प्राप्तकर्ता खाता संख्या',
        'withdraw_crypto_addr_lbl': 'USDT TRC20 प्राप्तकर्ता पता',
        'withdraw_bank_name_placeholder': 'उदा. DBS Bank या HDFC',
        'invite_lbl_inviter_preview': '🔍 आमंत्रितकर्ता: ',
        'deposit_channel_title': 'जमा चैनल',
        'withdraw_channel_title': 'निकासी चैनल',
        'back_btn': 'वापस',
        'invite_err_login_required': '🔒 कृपया अपनी आमंत्रित मित्रों की सूची देखने के लिए लॉग इन करें',
        'invite_empty_title': 'अभी तक कोई आमंत्रित मित्र नहीं',
        'invite_empty_desc': 'बोनस अर्जित करने के लिए अपना विशेष रेफ़रल कोड साझा करें!',
        'invite_register_prefix': 'पंजीकरण: ',
        'invite_status_enabled': 'सक्रिय',
        'invite_status_disabled': 'जमे हुए',
        'invite_err_fetch_failed': '⚠️ सूची प्राप्त करने में विफल:',
        'invite_err_network': '⚠️ नेटवर्क त्रुटि, सूची प्राप्त करने में असमर्थ',
        'invite_verify_success': '✓ रेफ़रलकर्ता सत्यापन सफल, कृपया बाध्यकारी पुष्टि करने के लिए क्लिक करें!',
        'invite_verify_fail': '❌ रेफ़रलकर्ता आईडी सत्यापन विफल, उपयोगकर्ता मौजूद नहीं है!',
        'invite_verify_error': '❌ रेफ़रलकर्ता जानकारी सत्यापन विफल रहा',
        'invite_bind_submitting': 'रेफ़रलकर्ता बाध्यता सबमिट की जा रही है...',
        'invite_bind_success': '✓ रेफ़रलकर्ता बाध्यता सफल!',
        'invite_bind_fail': '❌ रेफ़रलकर्ता बाध्यता विफल!',
        'invite_bind_error': '❌ नेटवर्क अनुरोध अपवाद',
        'invite_unit_people': ' मित्र',
        'profile_menu_download': 'ऐप डाउनलोड करें',
        'download_title': 'ऐप डाउनलोड करें',
        'download_desc': 'अपने मोबाइल डिवाइस प्लेटफॉर्म का चयन करें',
        'payment_modal_title': 'भुगतान खाता सेट करें',
        'payment_personal_info': 'व्यक्तिगत जानकारी',
        'payment_lbl_name': 'नाम',
        'payment_lbl_phone': 'फ़ोन',
        'payment_binding_info': 'खाता बाध्यकारी जानकारी',
        'payment_btn_edit': 'संपादित करें',
        'payment_not_bound': 'बाध्य नहीं है',
        'payment_header_edit_upi': 'UPI संपादित करें',
        'payment_placeholder_upi': 'UPI VPA दर्ज करें (जैसे jackson@oksbi)',
        'payment_btn_cancel': 'रद्द करें',
        'payment_btn_save': 'सहेजें',
        'payment_bank_card': 'बैंक कार्ड',
        'payment_lbl_bank_name': 'बैंक का नाम',
        'payment_lbl_bank_account': 'बैंक खाता',
        'payment_lbl_ifsc': 'IFSC',
        'payment_header_edit_bank': 'बैंक कार्ड संपादित करें',
        'payment_placeholder_bank_name': 'बैंक का नाम (जैसे DBS Bank)',
        'payment_placeholder_bank_account': 'बैंक खाता संख्या',
        'payment_placeholder_ifsc': 'IFSC कोड (जैसे HDFC0001234)',
        'payment_crypto_account': 'क्रिप्टो खाता',
        'payment_lbl_network': 'नेटवर्क',
        'payment_lbl_address': 'पता',
        'payment_lbl_memo': 'मेमो',
        'payment_header_edit_crypto': 'क्रिप्टो खाता संपादित करें',
        'payment_placeholder_crypto': 'TRC20 वॉलेट पता दर्ज करें',
        'payment_hint_safe': 'कृपया अपने भुगतान खाते का विवरण सुरक्षित और सही रखें।',
        'toast_online_support_prep': '🎧 ऑनलाइन ग्राहक सहायता लाइन तैयार की जा रही है, कृपया बाद में पुनः प्रयास करें।',
    }
};

function t(key) {
    if (TRANSLATIONS[currentLocale] && TRANSLATIONS[currentLocale][key]) {
        return TRANSLATIONS[currentLocale][key];
    }
    if (TRANSLATIONS['en'] && TRANSLATIONS['en'][key]) {
        return TRANSLATIONS['en'][key];
    }
    return key;
}

function toggleLanguageDropdown(event) {
    if (event) {
        event.stopPropagation();
    }
    const menu = document.getElementById('lang-dropdown-menu');
    if (menu) {
        menu.classList.toggle('active');
    }
    const profileMenu = document.getElementById('profile-lang-dropdown-menu');
    if (profileMenu) {
        profileMenu.classList.toggle('active');
    }
}

// Close dropdown if clicked outside
document.addEventListener('click', (e) => {
    const menu = document.getElementById('lang-dropdown-menu');
    const profileMenu = document.getElementById('profile-lang-dropdown-menu');
    const clickedBtn = e.target.closest('.lang-switch-btn');
    if (menu && !menu.contains(e.target) && !clickedBtn) {
        menu.classList.remove('active');
    }
    const clickedProfileRow = e.target.closest('.p-menu-row');
    if (profileMenu && !profileMenu.contains(e.target) && !clickedProfileRow) {
        profileMenu.classList.remove('active');
    }
});

function changeAppLanguage(locale, event) {
    if (event) {
        event.stopPropagation();
    }
    currentLocale = locale;
    localStorage.setItem('ait_app_locale', locale);
    
    // Apply translations
    applyTranslations();
    
    // Refresh profits rotator ticker in active language
    if (typeof initHomeProfitsRotator === 'function') {
        initHomeProfitsRotator();
    }
    
    // Refresh dynamic strategies lobby list & active positions list
    if (typeof loadQuantConfig === 'function') {
        loadQuantConfig();
    }
    if (typeof loadQuantOrders === 'function') {
        loadQuantOrders();
    }
    
    // Close dropdown
    const menu = document.getElementById('lang-dropdown-menu');
    if (menu) {
        menu.classList.remove('active');
    }
    const profileMenu = document.getElementById('profile-lang-dropdown-menu');
    if (profileMenu) {
        profileMenu.classList.remove('active');
    }
    
    // Update profile language switcher label
    const labelEl = document.getElementById('profile-lang-current-label');
    if (labelEl) {
        labelEl.innerText = locale === 'en' ? 'English' : 'हिन्दी';
    }
    
    const toastMsg = locale === 'en' ? 'Language switched to: English' : 'भाषा बदलकर हिन्दी कर दी गई है';
    showToast(toastMsg);
    
    // Smoothly reload page after 800ms to ensure all dynamic components render flawlessly in the new language
    setTimeout(() => {
        window.location.reload();
    }, 800);
}

function applyTranslations() {
    // Translate text nodes with data-i18n
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const translated = t(key);
        if (translated !== key) {
            el.innerHTML = translated;
        }
    });
    
    // Translate placeholders with data-i18n-placeholder
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        const translated = t(key);
        if (translated !== key) {
            el.setAttribute('placeholder', translated);
        }
    });
    
    // Update profile language switcher label on load and language change
    const labelEl = document.getElementById('profile-lang-current-label');
    if (labelEl) {
        labelEl.innerText = currentLocale === 'en' ? 'English' : 'हिन्दी';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Ensure only en and hi are supported locales, default to en
    if (currentLocale !== 'en' && currentLocale !== 'hi') {
        currentLocale = 'en';
        localStorage.setItem('ait_app_locale', 'en');
    }

    if (window.initSimulatedTime) window.initSimulatedTime();
    if (window.initHomeProfitsRotator) window.initHomeProfitsRotator();
    
    // Apply localized translations
    applyTranslations();
    
    // Load dynamic recommended instruments
    if (window.loadRecommendedInstruments) window.loadRecommendedInstruments();
    
    // URL Referral Code Capture
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const promoCode = urlParams.get('code') || urlParams.get('invite');
        if (promoCode) {
            setTimeout(() => {
                const inviteInput = document.getElementById('auth-invite-code');
                if (inviteInput) {
                    inviteInput.value = promoCode.toUpperCase();
                    if (window.verifyInviteCode) window.verifyInviteCode(promoCode.toUpperCase());
                }
            }, 800);
        }
    } catch(e) {
        console.error('Failed to capture URL referral code:', e);
    }

    // Bind invite code input change in login modal
    setTimeout(() => {
        const inviteInput = document.getElementById('auth-invite-code');
        if (inviteInput) {
            let verifyTimeout = null;
            inviteInput.addEventListener('input', () => {
                const code = inviteInput.value.trim().toUpperCase();
                inviteInput.value = code;
                
                if (verifyTimeout) clearTimeout(verifyTimeout);
                
                const welcomeBox = document.getElementById('auth-invite-welcome');
                const warningBox = document.getElementById('auth-invite-warning');
                if (welcomeBox) welcomeBox.style.display = 'none';
                if (warningBox) warningBox.style.display = 'none';
                
                if (code.length >= 5) {
                    verifyTimeout = setTimeout(() => {
                        if (window.verifyInviteCode) window.verifyInviteCode(code);
                    }, 400);
                }
            });
        }
    }, 1000);

    if (window.checkAuthSession) window.checkAuthSession();
    if (window.connectMarketWS) window.connectMarketWS();
    if (window.listenToBizEvents) window.listenToBizEvents();
    if (window.syncExchangeRates) window.syncExchangeRates();
    
    // Unconditional strategy configuration loading
    if (window.loadQuantConfig) window.loadQuantConfig();
    
    // Draw initial static sparklines for 首页 indices
    setTimeout(() => {
        if (window.drawIndexSparkline) {
            window.drawIndexSparkline('idx-btc-canvas', sparklinePools['BTCUSDT'], true);
            window.drawIndexSparkline('idx-eth-canvas', sparklinePools['ETHUSDT'], true);
            window.drawIndexSparkline('idx-sol-canvas', sparklinePools['SOLUSDT'], true);
            
            // Duplicated Market Tab Indices
            window.drawIndexSparkline('m-idx-btc-canvas', sparklinePools['BTCUSDT'], true);
            window.drawIndexSparkline('m-idx-eth-canvas', sparklinePools['ETHUSDT'], true);
            window.drawIndexSparkline('m-idx-sol-canvas', sparklinePools['SOLUSDT'], true);
        }
    }, 800);
});

// --- Dynamic Simulated Time in Phone Status Bar ---
function initSimulatedTime() {
    const timeEl = document.getElementById('live-time');
    if (!timeEl) return;
    const update = () => {
        const d = new Date();
        const hrs = d.getHours().toString().padStart(2, '0');
        const mins = d.getMinutes().toString().padStart(2, '0');
        timeEl.innerText = `${hrs}:${mins}`;
    };
    update();
    setInterval(update, 10000);
}

// --- Tab Router Switch (无缝单页切面渲染) ---

window.t = t;
window.toggleLanguageDropdown = toggleLanguageDropdown;
window.changeAppLanguage = changeAppLanguage;
window.applyTranslations = applyTranslations;
window.initSimulatedTime = initSimulatedTime;

export { t, changeAppLanguage, applyTranslations };
