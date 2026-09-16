// Genera un fichero SEPA Credit Transfer (pain.001.001.03) para pagar a
// varios sellers de una sola vez. El admin sube este XML a la banca online
// de Fastcop y paga a todos de golpe.
//
// Requiere las variables de entorno:
//   FASTCOP_COMPANY_NAME - nombre del ordenante (Fastcop)
//   FASTCOP_IBAN         - IBAN de la cuenta de Fastcop (sin espacios)
//   FASTCOP_BIC          - BIC/SWIFT del banco de Fastcop (opcional)

export type SepaPayment = {
  endToEndId: string; // referencia única de esta transferencia
  amount: number; // EUR, 2 decimales
  creditorName: string;
  creditorIban: string;
  creditorBic?: string | null;
  remittanceInfo: string; // texto que verá el seller en su extracto
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function cleanIban(iban: string): string {
  return iban.replace(/\s+/g, "").toUpperCase();
}

export function buildSepaXml(payments: SepaPayment[]): string {
  const debtorName = process.env.FASTCOP_COMPANY_NAME ?? "Fastcop";
  const debtorIban = cleanIban(process.env.FASTCOP_IBAN ?? "");
  const debtorBic = process.env.FASTCOP_BIC?.trim();

  const now = new Date();
  const msgId = `FASTCOP-${now.getTime()}`;
  const pmtInfId = `${msgId}-PMT`;
  const creDtTm = now.toISOString();
  // Fecha de ejecución: hoy (formato YYYY-MM-DD)
  const reqdExctnDt = now.toISOString().slice(0, 10);

  const ctrlSum = payments.reduce((s, p) => s + p.amount, 0).toFixed(2);

  const debtorAgtBlock = debtorBic
    ? `<DbtrAgt><FinInstnId><BIC>${escapeXml(debtorBic)}</BIC></FinInstnId></DbtrAgt>`
    : `<DbtrAgt><FinInstnId><Othr><Id>NOTPROVIDED</Id></Othr></FinInstnId></DbtrAgt>`;

  const txBlocks = payments
    .map((p) => {
      const creditorAgt = p.creditorBic
        ? `<CdtrAgt><FinInstnId><BIC>${escapeXml(p.creditorBic)}</BIC></FinInstnId></CdtrAgt>`
        : "";
      return `
      <CdtTrfTxInf>
        <PmtId>
          <EndToEndId>${escapeXml(p.endToEndId)}</EndToEndId>
        </PmtId>
        <Amt>
          <InstdAmt Ccy="EUR">${p.amount.toFixed(2)}</InstdAmt>
        </Amt>
        ${creditorAgt}
        <Cdtr>
          <Nm>${escapeXml(p.creditorName)}</Nm>
        </Cdtr>
        <CdtrAcct>
          <Id><IBAN>${cleanIban(p.creditorIban)}</IBAN></Id>
        </CdtrAcct>
        <RmtInf>
          <Ustrd>${escapeXml(p.remittanceInfo)}</Ustrd>
        </RmtInf>
      </CdtTrfTxInf>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <CstmrCdtTrfInitn>
    <GrpHdr>
      <MsgId>${escapeXml(msgId)}</MsgId>
      <CreDtTm>${creDtTm}</CreDtTm>
      <NbOfTxs>${payments.length}</NbOfTxs>
      <CtrlSum>${ctrlSum}</CtrlSum>
      <InitgPty>
        <Nm>${escapeXml(debtorName)}</Nm>
      </InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>${escapeXml(pmtInfId)}</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <NbOfTxs>${payments.length}</NbOfTxs>
      <CtrlSum>${ctrlSum}</CtrlSum>
      <ReqdExctnDt>${reqdExctnDt}</ReqdExctnDt>
      <Dbtr>
        <Nm>${escapeXml(debtorName)}</Nm>
      </Dbtr>
      <DbtrAcct>
        <Id><IBAN>${debtorIban}</IBAN></Id>
      </DbtrAcct>
      ${debtorAgtBlock}
      <ChrgBr>SLEV</ChrgBr>${txBlocks}
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>
`;
}
