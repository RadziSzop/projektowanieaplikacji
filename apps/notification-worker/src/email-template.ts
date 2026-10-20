function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character]!;
  });
}

export function renderLicenseEmail(key: string, licenseId: string) {
  return {
    text: `Twój klucz licencyjny Nova jest gotowy.\n\n${key}\n\nSkopiuj cały klucz i wklej go w polu aktywacji licencji.\nZachowaj tę wiadomość w bezpiecznym miejscu i nie udostępniaj klucza innym osobom.\n\nIdentyfikator licencji: ${licenseId}`,
    html: `<!doctype html>
<html lang="pl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Twój klucz licencyjny Nova</title></head>
<body style="margin:0;padding:0;background-color:#f1f4f8;color:#172438;font-family:Arial,Helvetica,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Twoja licencja Nova jest gotowa. Klucz i instrukcję aktywacji znajdziesz w wiadomości.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f4f8;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;table-layout:fixed;background-color:#ffffff;border:1px solid #dfe5ed;border-radius:16px;overflow:hidden;">
        <tr><td style="padding:28px 28px 24px;background-color:#172438;border-radius:16px 16px 0 0;">
          <p style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:4px;">NOVA<span style="color:#80b9ff;">.</span></p>
          <p style="margin:10px 0 0;color:#c5d2e4;font-size:13px;line-height:20px;">TWOJA LICENCJA</p>
        </td></tr>
        <tr><td style="padding:32px 28px;">
          <h1 style="margin:0 0 16px;font-size:28px;line-height:36px;font-weight:700;">Twój klucz jest gotowy.</h1>
          <p style="margin:0 0 24px;color:#526176;font-size:16px;line-height:26px;">Dziękujemy za wybór Nova. Poniżej znajdziesz swój klucz licencyjny.</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed;border:1px solid #c9dcf5;border-radius:10px;background-color:#f0f6ff;">
            <tr><td style="padding:20px;">
              <p style="margin:0 0 12px;color:#365b88;font-size:12px;font-weight:700;letter-spacing:1px;">KLUCZ LICENCYJNY</p>
              <p style="margin:0;color:#172438;font-family:Consolas,'Courier New',monospace;font-size:20px;font-weight:700;line-height:30px;word-break:break-all;overflow-wrap:anywhere;">${escapeHtml(key)}</p>
            </td></tr>
          </table>
          <h2 style="margin:28px 0 8px;font-size:17px;line-height:24px;">Jak aktywować licencję?</h2>
          <p style="margin:0;color:#526176;font-size:15px;line-height:25px;">Skopiuj cały klucz z powyższego pola i wklej go w polu aktywacji licencji.</p>
          <p style="margin:24px 0 0;color:#526176;font-size:13px;line-height:21px;">Zachowaj tę wiadomość w bezpiecznym miejscu. Klucz jest poufny — nie udostępniaj go innym osobom.</p>
        </td></tr>
        <tr><td style="padding:20px 28px;border-top:1px solid #e7ecf2;">
          <p style="margin:0 0 6px;color:#69788b;font-size:12px;line-height:18px;">Identyfikator licencji</p>
          <p style="margin:0;color:#526176;font-family:Consolas,'Courier New',monospace;font-size:12px;line-height:20px;word-break:break-all;overflow-wrap:anywhere;">${escapeHtml(licenseId)}</p>
        </td></tr>
      </table>
      <p style="margin:20px 0 0;color:#69788b;font-size:12px;line-height:20px;">Nova · Automatyczna wiadomość dotycząca Twojej licencji</p>
    </td></tr>
  </table>
</body>
</html>`,
  };
}
