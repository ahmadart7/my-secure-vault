// ==========================================
// إعدادات SUPABASE (لقد وضعت مفاتيحك التي أرسلتها)
// ==========================================
const SUPABASE_URL = 'https://enmtfhfydqdpdwmtrdyq.co';
const SUPABASE_ANON_KEY = 'sb_publishable_oVGdtrR_S4VjIgeTkfFRgw_tLKNZWY2';

// ⚠️ حماية ضد انهيار الملف (التأكد من تحميل المكتبة أولاً)
let supabase = null;
if (window.supabase) {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log("✅ تم ربط Supabase بنجاح");
} else {
    alert("⚠️ فشل تحميل مكتبة Supabase. يرجى التأكد من اتصال الإنترنت أو إيقاف مانع الإعلانات.");
}

// متغير الجلسة
let sessionMasterPassword = null;
let inactivityTimer;

// DOM Elements
const authSection = document.getElementById('auth-section');
const unlockSection = document.getElementById('unlock-section');
const appSection = document.getElementById('app-section');

// ==========================================
// 1. نظام تسجيل الدخول والمصادقة
// ==========================================
if (supabase) {
    supabase.auth.onAuthStateChange((event, session) => {
        if (session) {
            authSection.classList.add('hidden');
            if (!sessionMasterPassword) {
                unlockSection.classList.remove('hidden');
                appSection.classList.add('hidden');
            } else {
                unlockSection.classList.add('hidden');
                appSection.classList.remove('hidden');
                fetchVaults();
            }
            startInactivityTimer();
        } else {
            authSection.classList.remove('hidden');
            unlockSection.classList.add('hidden');
            appSection.classList.add('hidden');
            sessionMasterPassword = null;
            clearTimeout(inactivityTimer);
        }
    });
}

// أصبحت الوظيفة الآن آمنة وسيراها المتصفح حتى لو كان الإنترنت بطيئاً
async function signUp() {
    if (!supabase) return alert("لا يمكن التسجيل، لم يتم الاتصال بقاعدة البيانات.");
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) alert('خطأ في التسجيل: ' + error.message);
    else alert('تم التسجيل! يمكنك تسجيل الدخول الآن.');
}

async function signIn() {
    if (!supabase) return alert("لا يمكن تسجيل الدخول، لم يتم الاتصال بقاعدة البيانات.");

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert('خطأ في تسجيل الدخول: ' + error.message);
}

async function signOut() {
    sessionMasterPassword = null;
    await supabase.auth.signOut();
}

// ==========================================
// 2. نظام التشفير وفك التشفير (Client-Side)
// ==========================================
function unlockVault() {
    const mp = document.getElementById('master-password').value;
    if (!mp) return alert('الرجاء إدخال كلمة مرور التشفير');
    sessionMasterPassword = mp;
    document.getElementById('master-password').value = '';
    
    unlockSection.classList.add('hidden');
    appSection.classList.remove('hidden');
    fetchVaults();
}

function encrypt(text) {
    return CryptoJS.AES.encrypt(text, sessionMasterPassword).toString();
}

function decrypt(ciphertext) {
    try {
        const bytes = CryptoJS.AES.decrypt(ciphertext, sessionMasterPassword);
        const decrypted = bytes.toString(CryptoJS.enc.Utf8);
        return decrypted || '⚠️ خطأ: المفتاح غير صحيح';
    } catch (e) {
        return '⚠️ خطأ: تعذر فك التشفير';
    }
}

// ==========================================
// 3. إدارة البيانات (CRUD)
// ==========================================
async function addEntry() {
    const site = document.getElementById('site-name').value;
    const user = document.getElementById('site-username').value;
    const pass = document.getElementById('site-password').value;

    if (!site || !user || !pass) return alert('الرجاء تعبئة جميع الحقول');

    const encUser = encrypt(user);
    const encPass = encrypt(pass);

    const { data: { user: authUser } } = await supabase.auth.getUser();

    const { error } = await supabase
        .from('vaults')
        .insert([{ 
            user_id: authUser.id, 
            site_name: site, 
            encrypted_username: encUser, 
            encrypted_password: encPass 
        }]);

    if (error) {
        alert('خطأ أثناء الحفظ');
    } else {
        document.getElementById('site-name').value = '';
        document.getElementById('site-username').value = '';
        document.getElementById('site-password').value = '';
        fetchVaults();
    }
}

async function fetchVaults() {
    const { data, error } = await supabase.from('vaults').select('*').order('created_at', { ascending: false });
    if (error) return console.error(error);
    renderCards(data);
}

function renderCards(vaults) {
    const grid = document.getElementById('vault-grid');
    grid.innerHTML = '';

    vaults.forEach(item => {
        const plainUser = decrypt(item.encrypted_username);
        const plainPass = decrypt(item.encrypted_password);

        const card = document.createElement('div');
        card.className = 'card';
        card.setAttribute('data-site', item.site_name.toLowerCase());
        
        card.innerHTML = `
            <h3>${item.site_name}</h3>
            <div class="card-row">
                <span>المستخدم:</span>
                <strong id="user-${item.id}">••••••••</strong>
            </div>
            <div class="card-row">
                <span>المرور:</span>
                <strong id="pass-${item.id}">••••••••</strong>
            </div>
            <div class="card-actions">
                <button class="outline" onclick="toggleVisibility('${item.id}', '${plainUser}', '${plainPass}')">إظهار / إخفاء</button>
                <button onclick="copyToClipboard('${plainUser}')">نسخ المستخدم</button>
                <button onclick="copyToClipboard('${plainPass}')">نسخ المرور</button>
            </div>
        `;
        grid.appendChild(card);
    });
}

// ==========================================
// 4. وظائف الواجهة (نسخ، إظهار/إخفاء، بحث)
// ==========================================
function toggleVisibility(id, user, pass) {
    const userEl = document.getElementById(`user-${id}`);
    const passEl = document.getElementById(`pass-${id}`);
    
    if (userEl.innerText === '••••••••') {
        userEl.innerText = user;
        passEl.innerText = pass;
    } else {
        userEl.innerText = '••••••••';
        passEl.innerText = '••••••••';
    }
}

function copyToClipboard(text) {
    if(text.includes('⚠️')) return alert('لا يمكن النسخ، بيانات مشفرة بشكل خاطئ');
    navigator.clipboard.writeText(text).then(() => {
        alert('تم النسخ إلى الحافظة!');
    });
}

function filterCards() {
    const term = document.getElementById('search-bar').value.toLowerCase();
    const cards = document.querySelectorAll('.card');
    cards.forEach(card => {
        const siteName = card.getAttribute('data-site');
        card.style.display = siteName.includes(term) ? 'block' : 'none';
    });
}

// ==========================================
// 5. الأمان الإضافي (Auto-Logout)
// ==========================================
function resetTimer() {
    if (sessionMasterPassword) {
        clearTimeout(inactivityTimer);
        startInactivityTimer();
    }
}

function startInactivityTimer() {
    inactivityTimer = setTimeout(() => {
        alert('تم إغلاق الجلسة لأسباب أمنية بسبب الخمول.');
        signOut();
    }, 300000); 
}

window.onload = resetTimer;
document.onmousemove = resetTimer;
document.onkeypress = resetTimer;
document.ontouchstart = resetTimer;
