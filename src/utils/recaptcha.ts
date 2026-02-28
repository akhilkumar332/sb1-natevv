export const clearRecaptchaVerifier = () => {
  const container = document.getElementById('recaptcha-container');
  if (container) {
    container.remove();
  }
  if (window.recaptchaVerifier) {
    try {
      window.recaptchaVerifier.clear();
    } catch (error) {
      // no-op: best effort cleanup to avoid stale verifier issues
    }
    window.recaptchaVerifier = undefined;
  }
};
