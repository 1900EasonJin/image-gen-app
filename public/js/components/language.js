import { getLang, setLang } from '../i18n.js';

const languageSelector = document.getElementById('languageSelector');
const languageTrigger = document.getElementById('languageTrigger');
const languageTriggerText = document.getElementById('languageTriggerText');
const languageDropdown = document.getElementById('languageDropdown');

let dropdownOpen = false;

export function init() {
  // 初始化语言显示
  updateLanguageDisplay();

  // 切换下拉
  languageTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleDropdown();
  });

  // 点击外部关闭
  document.addEventListener('click', () => {
    if (dropdownOpen) closeDropdown();
  });

  // 键盘 ESC 关闭
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && dropdownOpen) closeDropdown();
  });

  // 语言选项点击
  languageDropdown.querySelectorAll('.language-option').forEach((option) => {
    option.addEventListener('click', () => {
      const lang = option.dataset.lang;
      setLang(lang);
      updateLanguageDisplay();
      updateActiveOption();
      closeDropdown();
    });
  });
}

function toggleDropdown() {
  if (dropdownOpen) {
    closeDropdown();
  } else {
    openDropdown();
  }
}

function openDropdown() {
  dropdownOpen = true;
  languageTrigger.classList.add('open');
  languageDropdown.classList.remove('hidden');
}

function closeDropdown() {
  dropdownOpen = false;
  languageTrigger.classList.remove('open');
  languageDropdown.classList.add('hidden');
}

function updateLanguageDisplay() {
  const lang = getLang();
  languageTriggerText.textContent = lang === 'zh' ? '中文' : 'English';
}

function updateActiveOption() {
  const lang = getLang();
  languageDropdown.querySelectorAll('.language-option').forEach((option) => {
    if (option.dataset.lang === lang) {
      option.classList.add('active');
    } else {
      option.classList.remove('active');
    }
  });
}
