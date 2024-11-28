import { parentPort, workerData } from 'worker_threads';
import fs from 'fs';
import path from 'path';

// 处理文件上传任务
async function handleUpload(files, uploadPath) {
  try {
    files.forEach((file) => {
      const decodedFileName = decodeURIComponent(file.originalname);
      const filePath = path.join(uploadPath, decodedFileName);
      fs.renameSync(file.path, filePath); // 重命名文件以确保文件名正确
    });

    // 模拟耗时任务
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return 'Files uploaded successfully';
  } catch (error) {
    throw new Error(`Error during upload: ${error.message}`);
  }
}

// 开始处理任务
handleUpload(workerData.files, workerData.uploadPath)
  .then((result) => parentPort.postMessage({ success: true, message: result }))
  .catch((error) =>
    parentPort.postMessage({ success: false, message: error.message })
  );
