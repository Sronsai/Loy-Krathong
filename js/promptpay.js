/* สร้าง payload QR พร้อมเพย์ (EMVCo / Thai QR Payment) พร้อมยอดเงิน */
(function () {
  function f(id, value) {
    return id + String(value.length).padStart(2, '0') + value;
  }
  function crc16(str) {
    let crc = 0xffff;
    for (let i = 0; i < str.length; i++) {
      crc ^= str.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) {
        crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
        crc &= 0xffff;
      }
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
  }
  function payload(target, amount) {
    let id = String(target || '').replace(/[^0-9]/g, '');
    if (!id) return '';
    let tag;
    if (id.length >= 13) tag = '02';                       // เลขผู้เสียภาษี/บัตรประชาชน
    else { tag = '01'; id = ('0000000000000' + id.replace(/^0/, '66')).slice(-13); } // เบอร์มือถือ
    const merchant = f('00', 'A000000677010111') + f(tag, id);
    let data = f('00', '01') + f('01', amount ? '12' : '11') + f('29', merchant) + f('58', 'TH') + f('53', '764');
    if (amount) data += f('54', Number(amount).toFixed(2));
    data += '6304';
    return data + crc16(data);
  }
  window.PromptPay = { payload };
})();
