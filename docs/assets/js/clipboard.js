/**
 * Offline Ark - Clipboard Module
 * Adds copy-to-clipboard functionality for code blocks.
 * No external dependencies. Includes a fallback for browsers
 * that lack the Clipboard API.
 */
(function () {
  'use strict';

  var FEEDBACK_DURATION = 2000; // ms

  // ------------------------------------------------------------------
  // Copy helpers
  // ------------------------------------------------------------------

  /**
   * Resolve the text content to copy for a given copy button.
   * Looks for a sibling with .code-content, or the nearest <code>/<pre>
   * inside the same parent.
   */
  function getTextToCopy(button) {
    // 1. Sibling with .code-content
    var sibling = button.parentNode.querySelector('.code-content');
    if (sibling) {
      return sibling.textContent || '';
    }

    // 2. <code> element in parent
    var code = button.parentNode.querySelector('code');
    if (code) {
      return code.textContent || '';
    }

    // 3. <pre> element in parent
    var pre = button.parentNode.querySelector('pre');
    if (pre) {
      return pre.textContent || '';
    }

    // 4. Walk up one more level and try again
    var grandparent = button.parentNode.parentNode;
    if (grandparent) {
      var gpCode = grandparent.querySelector('code');
      if (gpCode) {
        return gpCode.textContent || '';
      }
      var gpPre = grandparent.querySelector('pre');
      if (gpPre) {
        return gpPre.textContent || '';
      }
    }

    return '';
  }

  /**
   * Modern copy using the Clipboard API (async, requires secure context).
   */
  function clipboardApiCopy(text) {
    return navigator.clipboard.writeText(text);
  }

  /**
   * Fallback copy using a hidden textarea and execCommand.
   * Works in older browsers and non-secure contexts.
   */
  function fallbackCopy(text) {
    return new Promise(function (resolve, reject) {
      var textarea = document.createElement('textarea');
      textarea.value = text;

      // Prevent scrolling and keep the element invisible.
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.top = '-9999px';
      textarea.style.left = '-9999px';
      textarea.style.opacity = '0';

      document.body.appendChild(textarea);
      textarea.select();

      try {
        var success = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (success) {
          resolve();
        } else {
          reject(new Error('execCommand copy returned false'));
        }
      } catch (err) {
        document.body.removeChild(textarea);
        reject(err);
      }
    });
  }

  /**
   * Copy text to the clipboard using the best available method.
   */
  function copyText(text) {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      return clipboardApiCopy(text);
    }
    return fallbackCopy(text);
  }

  // ------------------------------------------------------------------
  // Visual feedback
  // ------------------------------------------------------------------

  /**
   * Temporarily swap the button content to a checkmark and add a
   * success class, then revert after FEEDBACK_DURATION.
   */
  function showSuccess(button) {
    var originalHTML = button.innerHTML;
    var originalAriaLabel = button.getAttribute('aria-label');

    button.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
    button.classList.add('copy-success');
    button.setAttribute('aria-label', 'Copied!');

    setTimeout(function () {
      button.innerHTML = originalHTML;
      button.classList.remove('copy-success');
      if (originalAriaLabel) {
        button.setAttribute('aria-label', originalAriaLabel);
      } else {
        button.removeAttribute('aria-label');
      }
    }, FEEDBACK_DURATION);
  }

  function showError(button) {
    button.classList.add('copy-error');
    setTimeout(function () {
      button.classList.remove('copy-error');
    }, FEEDBACK_DURATION);
  }

  // ------------------------------------------------------------------
  // Event binding
  // ------------------------------------------------------------------

  function handleClick(event) {
    var button = event.currentTarget;
    var text = getTextToCopy(button);

    if (!text) {
      showError(button);
      return;
    }

    copyText(text)
      .then(function () {
        showSuccess(button);
      })
      .catch(function () {
        showError(button);
      });
  }

  // ------------------------------------------------------------------
  // Initialization
  // ------------------------------------------------------------------

  function initClipboard() {
    var buttons = document.querySelectorAll('.copy-btn');

    buttons.forEach(function (button) {
      // Set a default aria-label if none is present.
      if (!button.getAttribute('aria-label')) {
        button.setAttribute('aria-label', 'Copy to clipboard');
      }

      button.addEventListener('click', handleClick);
    });
  }

  // Expose for app.js.
  window.OfflineArkClipboard = {
    init: initClipboard
  };
})();
