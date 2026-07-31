const { google } = require('googleapis');

const GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 ?? "";
const GOOGLE_SPREADSHEET_ID_SNS = process.env.GOOGLE_SPREADSHEET_ID_SNS ?? "";
const credentials = JSON.parse(
    Buffer.from(GOOGLE_SERVICE_ACCOUNT_KEY_BASE64, "base64").toString("utf-8")
);

const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });

// --- データ取得 ---
export async function getData(range: string) {
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: GOOGLE_SPREADSHEET_ID_SNS,
        range
    });
    console.info(res.data.values); // 二次元配列で返ってくる
    return res.data.values;
}

// --- データ更新（上書き） ---
// export async function updateData(range: string, values: any[]) {
//     await sheets.spreadsheets.values.update({
//         spreadsheetId: SPREADSHEET_ID,
//         range,
//         valueInputOption: 'USER_ENTERED', // 数式なども解釈させたい場合
//         requestBody: {
//             values: [
//                 ['名前', '年齢', '職業'],
//                 ['田中', 30, 'エンジニア'],
//             ],
//         },
//     });
//     console.info('更新完了');
// }

// --- データ追加（末尾に行を足す） ---
export async function appendData(updateRows: string[][]) {
    await sheets.spreadsheets.values.append({
        spreadsheetId: GOOGLE_SPREADSHEET_ID_SNS,
        range: 'アイドル深層_X!A1',
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
            values: updateRows,
        },
    });
    console.info('追加完了');
}