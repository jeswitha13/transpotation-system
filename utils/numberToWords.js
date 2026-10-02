/**
 * Convert numeric Indian currency to words
 * Example: 15000 -> "Rupees Fifteen Thousand Only"
 */

function numberToWords(amount) {
  const num = Math.round(Number(amount));
  if (isNaN(num) || num <= 0) return 'Rupees Zero Only';

  const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertTwoDigits(n) {
    if (n === 0) return '';
    if (n < 10) return units[n];
    if (n < 20) return teens[n - 10];
    const unit = n % 10;
    return tens[Math.floor(n / 10)] + (unit > 0 ? ' ' + units[unit] : '');
  }

  function convertThreeDigits(n) {
    const hundred = Math.floor(n / 100);
    const rest = n % 100;
    let res = '';
    if (hundred > 0) {
      res += units[hundred] + ' Hundred';
      if (rest > 0) res += ' and ';
    }
    if (rest > 0) {
      res += convertTwoDigits(rest);
    }
    return res;
  }

  // Indian Numbering System: Crores, Lakhs, Thousands, Hundreds
  let crore = Math.floor(num / 10000000);
  let remainder = num % 10000000;

  let lakh = Math.floor(remainder / 100000);
  remainder = remainder % 100000;

  let thousand = Math.floor(remainder / 1000);
  remainder = remainder % 1000;

  let hundredPart = remainder;

  let parts = [];

  if (crore > 0) {
    parts.push(convertThreeDigits(crore) + ' Crore');
  }
  if (lakh > 0) {
    parts.push(convertTwoDigits(lakh) + ' Lakh');
  }
  if (thousand > 0) {
    parts.push(convertTwoDigits(thousand) + ' Thousand');
  }
  if (hundredPart > 0) {
    parts.push(convertThreeDigits(hundredPart));
  }

  const words = parts.join(' ').trim();
  return `Rupees ${words} Only`;
}

module.exports = { numberToWords };
