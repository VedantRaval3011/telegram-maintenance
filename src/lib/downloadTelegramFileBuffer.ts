export async function downloadTelegramFileBuffer(fileId: string): Promise<Buffer> {
  const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

  // Get file path
  const fileInfo = await fetch(`${TELEGRAM_API}/getFile?file_id=${fileId}`).then(r => r.json());
  if (!fileInfo.ok) throw new Error("Failed to get Telegram file path");

  const filePath = fileInfo.result.file_path;

  // Download file as arrayBuffer
  const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${filePath}`;
  const arrayBuffer = await fetch(fileUrl).then(r => r.arrayBuffer());

  return Buffer.from(arrayBuffer);
}
