import { sheets, auth, sheets_v4 } from "@googleapis/sheets";

const GOOGLE_SPREADSHEET_ID_SNS = process.env.GOOGLE_SPREADSHEET_ID_SNS ?? "";
const GOOGLE_SHEETS_KEY_BASE64 = process.env.GOOGLE_SHEETS_KEY_BASE64 ?? "";

function getSheetsClient(): sheets_v4.Sheets {
    const decoded = Buffer
        .from(GOOGLE_SHEETS_KEY_BASE64, "base64")
        .toString("utf8");

    const credentials = JSON.parse(decoded);
    const param = {
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    };
    console.info("GoogleAuth", { param, credentials });
    const googleAuth = new auth.GoogleAuth(param);
    return sheets({ version: 'v4', auth: googleAuth });
}

// --- データ取得 ---
export async function getSheetData(range: string) {
    const sheetsClient = getSheetsClient();
    const res = await sheetsClient.spreadsheets.values.get({
        spreadsheetId: GOOGLE_SPREADSHEET_ID_SNS,
        range
    });
    console.info(res.data.values); // 二次元配列で返ってくる
    return res.data.values;
}

// --- データ追加（末尾に行を足す） ---
export async function appendSheetData(updateRows: string[][], range: string) {
    console.info('appendSheetData', updateRows, range);
    const sheetsClient = getSheetsClient();
    const param = {
        spreadsheetId: GOOGLE_SPREADSHEET_ID_SNS,
        range: range,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: updateRows }
    };
    console.info("append", param);
    await sheetsClient.spreadsheets.values.append(param);
    console.info('追加完了');
}

// --- データ削除（値のみクリア）---
export async function clearSheetData(range: string) {
    const sheetsClient = getSheetsClient();
    const res = await sheetsClient.spreadsheets.values.clear({
        spreadsheetId: GOOGLE_SPREADSHEET_ID_SNS,
        range
    });
    console.info(`Cleared range: ${range}`);
    return res.data;
}
