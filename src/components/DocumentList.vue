<script setup lang="ts">
import { ref, watch, h, computed, onMounted, nextTick } from 'vue';
import axios from 'axios';
import { useRoute, useRouter } from 'vue-router';
import { EditOutlined, DeleteOutlined, CheckCircleOutlined, UploadOutlined, FolderAddOutlined, UnlockOutlined, LockOutlined, BgColorsOutlined, DownloadOutlined, TagOutlined } from '@ant-design/icons-vue';
import { Modal, message } from 'ant-design-vue';
// @ts-ignore
import { saveAs } from 'file-saver';
import { useSpinningStore } from '../stores/spinningStore';
import Folder from './Folder.vue';
import Gallery from './Gallery.vue';
import Permissions from './Permissions.vue';
import debounce from 'lodash/debounce';

// @ts-ignore 这里组件类型莫名报错
import OtherFile from './OtherFile.vue';

import './DocumentList.css'; // 引入外部 CSS 文件

const validImageExtensions = ['.jpeg', '.jpg', '.png', '.gif', '.webp'];

const route = useRoute();
const router = useRouter();
const spinningStore = useSpinningStore();

const props = defineProps<{ isDarkMode: boolean }>();

// todo 按照目前的现有的结构，再弄一个上层父级的分类
// { { id: 标签id, name: "标签名称", color: "标签颜色", list: { imageUrls: [], folderLinks: [], otherFiles: [] }  } }
const sortPanelData = ref<{ id: string, name: string, list: { imageUrls: TypeFile[], folderLinks: TypeFile[], otherFiles: TypeFile[] } }[]>([]);
const currentPasswordMap = ref<Record<string, string>>({}); // 记录当前文件夹层的密码
const currentPassword = ref<string>(); // 记录当前文件夹层的密码
const loading = ref<1 | 2 | 3>(1); // 1初始化 2 loading 3完成
const canSaveScrollPos = ref<boolean>(false);

// 每次currentPasswordMap改动时，存储到sessionStorage
watch(currentPasswordMap, (newValue) => {
  sessionStorage.setItem('currentPasswordMap', JSON.stringify(newValue));
}, { deep: true }); // deep:true 监听对象的深层变化

// 直接改为false 不需要颜色 转换为 分类
const isSortByFilesByTagMode = ref(true); // ref(JSON.parse(localStorage.getItem('isSortByFilesByTagMode') || 'false'));

const encryptedFiles = ref<string[]>([]);

watch(isSortByFilesByTagMode, (newValue) => {
  localStorage.setItem('isSortByFilesByTagMode', JSON.stringify(newValue));
});

const sortFilesByTag = () => {
  if (!isSortByFilesByTagMode.value) {
    console.log("按照颜色排序");
    return;
  }
  const tagMap = new Map<string, { id: string, name: string, commonSortOrder?: number, list: { imageUrls: TypeFile[], folderLinks: TypeFile[], otherFiles: TypeFile[] } }>();

  const processFile = (file: TypeFile, type: keyof typeof sortPanelData.value[0]['list']) => {
    const { id = "0", name = "", color = "" } = file.tag || {};

    if (!tagMap.has(id)) {
      tagMap.set(id, {
        id,
        name,
        list: { imageUrls: [], folderLinks: [], otherFiles: [] }
      });
    }

    const tagEntry = tagMap.get(id);
    if (tagEntry) {
      tagEntry.list[type].push(file);
    }
  }

  // 处理 imageUrls
  imageUrls.value.forEach(file => processFile(file, 'imageUrls'));

  // 处理 folderLinks
  folderLinks.value.forEach(file => processFile(file, 'folderLinks'));

  // 处理 otherFiles
  otherFiles.value.forEach(file => processFile(file, 'otherFiles'));

  // 完善：从 baseTags 中找到对应的 commonSortOrder，并设置到 tagMap
  tagMap.forEach((tagEntry, id) => {
    const matchingTag = baseTags.value.find((tag) => tag.id === id);
    if (matchingTag) {
      tagEntry.commonSortOrder = matchingTag.commonSortOrder ?? Number.MAX_SAFE_INTEGER;
    } else {
      tagEntry.commonSortOrder = Number.MAX_SAFE_INTEGER; // 未定义的放到最后
    }
  });

  // 将结果从小到大排序
  sortPanelData.value = Array.from(tagMap.values()).sort((a: any, b: any) => {
    // 如果 commonSortOrder 存在，则按其排序
    const orderA = a.commonSortOrder ?? Number.MAX_SAFE_INTEGER; // 未定义的排序值放到最后
    const orderB = b.commonSortOrder ?? Number.MAX_SAFE_INTEGER;

    return orderA - orderB; // 按照 commonSortOrder 升序排列
  });
};

type TypeTagColor = { color: string, name: string, id: string, commonSortOrder: number }
const baseColors = ref<string[]>(["#ff6b57", "#ff9100", "#ffda00", "#20ce0a", "#508dfe", "#a260ff", "#ffffff"]);
const baseTags = ref<TypeTagColor[]>([]);
const tagSearchValue = ref('');
const selectedColor = ref('');
// 计算属性，动态过滤tags
const filteredTags = computed(() => {
  return baseTags.value
    .filter(tag => tag.name.toLowerCase().includes(tagSearchValue.value.toLowerCase()))
    .sort((a, b) => a.id === '0' ? 1 : (b.id === '0' ? -1 : 0));
});
const selectColor = (color: string) => {
  selectedColor.value = color;
};
// 创建标签
const createTag = async () => {
  if (filteredTags.value.length !== 0) {
    return;
  }

  if (tagSearchValue.value.trim()) {
    const newTag = {
      color: "",
      name: tagSearchValue.value.trim(),
      id: Date.now().toString(), // 生成唯一的ID
      commonSortOrder: 0,
    };

    try {
      // 将新标签数据发送到服务器
      await axios.post('/create-tag', { tag: newTag });
      message.success(`创建标签“${newTag.name}”成功`);

      // 将新标签添加到本地 baseTags 列表
      baseTags.value.push(newTag);

      // 清空输入和选择的颜色
      tagSearchValue.value = '';
      selectedColor.value = '';
    } catch (error) {
      console.error('Error creating tag:', error);
      message.error('创建标签失败');
    }
  }
};

// 
const setFileColor = async (color: string) => {
  const filesToTag = [...selectedFiles.value, ...selectedImages.value, ...selectedFold.value].map(filePath => ({
    path: filePath.replace(/https?:\/\/[^\/:]+(:\d+)?\//, ''),  // 移除URL前缀，匹配带端口号的路径
    tag: {
      color
    }
  }));

  try {
    await axios.post('/set-file-color', { files: filesToTag });
    message.success("设置成功");

    fetchHtmlAndExtractImages();

    toggleSelectMode();
  } catch (error) {
    console.error('Error setting tags:', error);
  }
}

// 设置标签
const selectTag = async (id: string) => {
  const tag = baseTags.value.find(tag => tag.id === id);
  const filesToTag = [...selectedFiles.value, ...selectedImages.value, ...selectedFold.value].map(filePath => ({
    path: filePath.replace(/https?:\/\/[^\/:]+(:\d+)?\//, ''),  // 移除URL前缀，匹配带端口号的路径
    tag
  }));

  try {
    await axios.post('/set-tags', { files: filesToTag });
    message.success("设置成功");

    fetchHtmlAndExtractImages();

    // 省时 可优化
    // selectOtherFileIndex.value.forEach((index: number) => {
    //   otherFiles.value[index].tag = tag;
    // })
    // selectImageIndex.value.forEach((index: number) => {
    //   imageUrls.value[index].tag = tag;
    // })
    // selectFoldIndex.value.forEach((index: number) => {
    //   folderLinks.value[index].tag = tag;
    // })

    toggleSelectMode();
  } catch (error) {
    console.error('Error setting tags:', error);
  }
};

const ClearSelect = () => {
  selectOtherFileIndex.value = [];
  selectImageIndex.value = [];
  selectFoldIndex.value = [];

  selectedFiles.value.clear();
  selectedImages.value.clear();
  selectedFold.value.clear();
}

// 查询标签
const fetchTags = async (files: TypeFile[]) => {
  // 获取路径数组并移除URL前缀
  const paths = files.map(image => image.url.replace(/https?:\/\/[^\/:]+(:\d+)?\//, ''));

  try {
    // 发送请求获取标签信息
    const response = await axios.post('/get-tags-from-file', { paths });

    // 更新每个imageUrls中的标签信息
    files.forEach((image, index) => {
      if (response.data[index].havePassword) {
        encryptedFiles.value.push(image.url);
      }

      image.tag = response.data[index]; // 将返回的标签设置到对应的image
    });

    return Promise.resolve();
  } catch (error) {
    console.error('Error fetching tags:', error);
    return Promise.reject();
  }
};

type TypeFile = { url: string, name: string, lastModified: number, fileSize: string, lastModifiedText?: string, tag?: TypeTagColor, close?: boolean };
const imageUrls = ref<TypeFile[]>([]);
const folderLinks = ref<TypeFile[]>([]);
const otherFiles = ref<TypeFile[]>([]);

const selectedImages = ref<Set<string>>(new Set());
const selectedFiles = ref<Set<string>>(new Set());
const selectedFold = ref<Set<string>>(new Set());
const isSelectMode = ref(false);
const isEditMode = ref(false);
const folderPath = ref(route.params.folderPath as String || '/');
const searchValue = ref<string>('');
const onSearch = (_searchValue: string) => {

  if (_searchValue.length === 0) {
    fetchHtmlAndExtractImages();
    return;
  }
  spinningStore.setSpinning(true, "正在搜索");

  // 发送 POST 请求到后端
  axios.post("/search-files", {
    query: _searchValue, // 传递搜索值给后端
  }).then(async ({ data }) => {

    // @ts-ignore
    imageUrls.value = data.image;
    folderLinks.value = data.fold;
    otherFiles.value = data.other;

    // todo 搜索的时候 调用标签信息 这块代码很烂，需要修改，合并为一个请求
    if (imageUrls.value.length > 0) {
      await fetchTags(imageUrls.value);
    }
    if (folderLinks.value.length > 0) {
      await fetchTags(folderLinks.value);
    }
    if (otherFiles.value.length > 0) {
      await fetchTags(otherFiles.value);
    }
  }).catch((e) => {
    message.error('没有找到相关文件或文件夹');
    console.log(e);
  }).finally(() => {
    spinningStore.toggleSpinning();
    sortFilesByTag();
  });
};

const IMAGE_BASE_URL = import.meta.env.VITE_IMAGE_BASE_URL;

const parseTimeStampFormat2 = (timestamp: number) => {
  // 定义选项以进行日期和时间格式化
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false // 使用24小时制
  };

  // 使用 Intl.DateTimeFormat 进行格式化
  const formatter = new Intl.DateTimeFormat('zh-CN', options);

  // 将时间戳转换为 Date 对象
  const formattedDate = formatter.format(new Date(timestamp));

  // 输出结果
  return formattedDate;
}

const parseDate = (dateString: string) => {
  // 定义中文月份到英文月份的映射
  const months: { [key: string]: string } = {
    "1月": "Jan",
    "2月": "Feb",
    "3月": "Mar",
    "4月": "Apr",
    "5月": "May",
    "6月": "Jun",
    "7月": "Jul",
    "8月": "Aug",
    "9月": "Sep",
    "10月": "Oct",
    "11月": "Nov",
    "12月": "Dec"
  };

  // 提取日、月、年和时间部分
  const [datePart, timePart] = dateString.split(' ');
  const [day, month, year] = datePart.split('-');

  // 获取对应的英文月份
  const monthEnglish = months[month] || month; // 如果没有匹配到，则保留原来的月份

  // 构建有效的日期字符串
  const formattedDateString = `${day} ${monthEnglish} ${year} ${timePart}`;

  // 返回时间戳
  return new Date(formattedDateString).getTime();
};

// 获取文件列表
let timeoutId: any; // 用于存储 setInterval 的 ID
let currentLinks: any[] = []; // 存储当前的链接列表

const fetchHtmlAndExtractImages = async (): Promise<void> => {
  canSaveScrollPos.value = false;
  spinningStore.setSpinning(true, "Loading");
  const curUrl = `${IMAGE_BASE_URL}${folderPath.value}`;

  let username = 'admin';
  let password: string | null = '';

  if (timeoutId) {
    clearInterval(timeoutId);
  }

  try {
    let response
    let errorCode = 0;

    try {
      response = await axios.get(curUrl);
    } catch (error: any) {
      // console.log("完整错误对象:", error);
      // if (error.response) {
      //   console.log("HTTP 错误状态码:", error.response.status);
      //   console.log("详细错误信息:", error.response.data);
      //   errorCode = error.response.status;
      // } else if (error.request) {
      //   console.log("请求发出但无响应:", error.request, curUrl);
      // } else {
      //   console.log("其他错误:", error.message);
      // }
      errorCode = 401;
    }

    if (errorCode) {
      console.log(errorCode, '错误code');
      // 资源受保护，需要密码
      if (errorCode == 401) {
        console.log("401 http code");
        // 如果存在密码，则不用再输入
        if (currentPasswordMap.value[curUrl]) {
          password = currentPasswordMap.value[curUrl];
        } else {
          // 定位bug;
          password = prompt("请输入密码");
        }

        if (password == null) {
          router.back();
          return;
        }

        // 将用户名和密码进行 Base64 编码
        const token = btoa(`${username}:${password}`);

        // 重新发起带密码的请求
        const protectedResponse = await axios.get(curUrl, {
          headers: {
            'Authorization': `Basic ${token}` // 设置 Authorization 头
          }
        });
        response = protectedResponse;

        currentPassword.value = password;
        currentPasswordMap.value[curUrl] = password;
      }

      // 没有权限访问内容
      if (errorCode == 403) {
        message.error("当前没有权限访问该内容");
        router.back();
        return;
      }
    } else {
      currentPassword.value = undefined;
      console.log("错误", errorCode);
    }

    searchValue.value = "";
    folderLinks.value = [];
    imageUrls.value = [];
    otherFiles.value = [];
    selectedImages.value.clear();
    selectedFiles.value.clear();
    selectedFold.value.clear();
    currentLinks = [];

    const html = response!.data;

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const links = doc.querySelectorAll('.display-name a');
    const dates = doc.querySelectorAll('.last-modified');
    const sizes = doc.querySelectorAll('.file-size code'); // 获取文件大小的元素

    links.forEach((link, index) => {
      let fileName = link.textContent?.trim();
      let lastModifiedText = dates[index].textContent?.trim();

      const lastModified = parseDate(lastModifiedText!);

      lastModifiedText = parseTimeStampFormat2(lastModified);

      const fileSize = sizes[index].textContent?.trim() || '0'; // 获取文件大小

      if (fileName!.endsWith('/')) {
        if (fileName !== '../') {
          fileName = fileName?.replace(/\/$/, ''); // 去除末尾的斜杠
          let url = ""
          // 这里可选 暂时没有定位到bug
          if (fileName?.startsWith('/') || curUrl?.endsWith('/')) {
            url = curUrl + fileName
          } else {
            url = curUrl + "/" + fileName
          }
          folderLinks.value.push({ url, name: fileName!, lastModified, fileSize, lastModifiedText }); // 为什么要加上 "/" +  ？
        }
      } else {
        const extension = fileName!.split('.').pop()?.toLowerCase();
        if (validImageExtensions.includes(`.${extension}`)) {
          currentLinks.push({ url: curUrl + '/' + fileName, name: fileName!, lastModified, fileSize, lastModifiedText, close: true });
        } else {
          otherFiles.value.push({ url: curUrl + '/' + fileName, name: fileName!, lastModified, fileSize, lastModifiedText });
        }
      }
    });

    // todo 合并查询
    if (folderLinks.value.length > 0) {
      await fetchTags(folderLinks.value);
      console.log(folderLinks.value);
    }
    if (otherFiles.value.length > 0) {
      await fetchTags(otherFiles.value);
    }

    // 定时推送数据到 imageUrls，每0.5秒推送10个数据
    const fn = async () => {
      const batchSize = 40; // 每次推送的数量
      if (index < currentLinks.length) {
        loading.value = 2;
        const nextBatch = currentLinks.slice(index, index + batchSize);

        // 直接修改原对象指针
        await fetchTags(nextBatch).then(() => {
          imageUrls.value.push(...nextBatch);
          index += batchSize;
        });

        await fn();
      } else {
        loading.value = 3;
        // 完成  isSortByFilesByTagMode 都还没更新，就已经去触发这个了，所以不会渲染
        sortFilesByTag();
        sortItems(); // 加载数据后进行排序
      }
      return fn;
    };
    let index = 0;
    fn();

  } catch (error) {
    delete currentPasswordMap.value[curUrl]
    router.back();
    console.error('Error fetching HTML:', error);
  }

  console.log("请求完成")
  setTimeout(() => {
    spinningStore.setSpinning(false, "Loading");
  }, 300)
};

// 导航到指定文件夹
const navigateToFolder = (folderName: string, useRouter: boolean = true) => {
  const path = `${folderPath.value}${folderPath.value === '/' ? '' : '/'}${folderName}`;
  useRouter && router.push(`${folderPath.value}${folderPath.value === '/' ? '' : '/'}${folderName}`);
  return path;
};

const selectImageIndex = ref<number[]>([]);

// 批量选择
const handleSelectImage = (url: string, checked: boolean, index: number) => {
  if (checked) {
    selectedImages.value.add(url);
    selectImageIndex.value.push(index);
  } else {
    selectedImages.value.delete(url);
    selectImageIndex.value.splice(index, 1);
  }
};

const selectFoldIndex = ref<number[]>([]);

// 批量选择
const handleSelectFolds = (url: string, checked: boolean, index: number) => {
  if (checked) {
    selectedFold.value.add(url);
    selectFoldIndex.value.push(index);
  } else {
    selectedFold.value.delete(url);
    selectFoldIndex.value.splice(index, 1);
  }
};

const selectOtherFileIndex = ref<number[]>([]);

// 分开是因为大文件 和 图片的方式是不一样的，这种文件是需要额外的设置下载的，所以分开选择
const handleSelectFile = (url: string, checked: boolean, index: number) => {
  if (checked) {
    selectedFiles.value.add(url);
    selectOtherFileIndex.value.push(index);
  } else {
    selectedFiles.value.delete(url);
    selectOtherFileIndex.value.splice(index, 1);
  }
};

// 切换选择模式
const toggleSelectMode = () => {
  isSelectMode.value = !isSelectMode.value;

  if (isSelectMode.value == false) {
    ClearSelect();
  } else {
    isEditMode.value = false;
  }
};

// 切换编辑模式
const toggleEditMode = () => {
  isEditMode.value = !isEditMode.value;
};

// 批量下载
const downloadSelectedItems = () => {
  const selectedItems = new Set([...selectedImages.value, ...selectedFiles.value]);
  Modal.confirm({
    title: '下载确认',
    content: `你确认要下载选中的 ${selectedItems.size} 个文件吗？`,
    onOk() {
      selectedItems.forEach(async (url) => {
        const response = await fetch(url);
        const blob = await response.blob();
        saveAs(blob, url.split('/').pop()!);
      });
      return Promise.resolve();
    },
  });
};

const fileQueue = ref<any[]>([]);
const isUploading = ref(false);

const beforeUpload = (file: any) => {
  // 对文件名进行编码
  const encodedFile = new File([file], encodeURIComponent(file.name), { type: file.type });
  fileQueue.value.push(encodedFile);

  if (!isUploading.value) {
    uploadNextFile();
  }
  return false; // 手动处理上传事件
};

// 处理批量上传功能
const uploadNextFile = async () => {
  spinningStore.setSpinning(true, "正在上传中，请勿刷新或关闭页面");
  if (fileQueue.value.length === 0) {
    isUploading.value = false;
    setTimeout(() => {
      spinningStore.toggleSpinning();
      fetchHtmlAndExtractImages(); // 触发刷新事件
    }, 1000);
    return;
  }

  isUploading.value = true;
  const file = fileQueue.value.shift();
  const formData = new FormData();

  formData.append('uploadPath', folderPath.value as any);
  formData.append('files', file);

  try {

    const response = await fetch('/upload', {
      method: 'POST',
      body: formData
    });

    if (response.ok) {
      message.success(`${decodeURIComponent(file.name)} uploaded successfully`);
      uploadNextFile(); // 递归上传下一个文件
      if (file.onSuccess) {
        file.onSuccess(response.body, file); // 通知上传成功
      }
    } else {
      throw new Error('Upload failed');
    }
  } catch (error) {
    console.error('Error uploading file:', error);
    message.error('Error uploading file');
    if (file.onError) {
      file.onError(error); // 通知上传失败
    }
    uploadNextFile(); // 继续尝试上传下一个文件，即使当前文件上传失败
  }
};

// 创建文件夹
const createFolder = () => {
  let inputValue = '';

  Modal.confirm({
    title: '创建文件夹',
    content: h('Input', {
      id: 'new-folder-name',
      placeholder: '请输入文件夹名称',
      onInput: (e: any) => inputValue = e.target.value
    }),
    onOk() {
      if (!inputValue) {
        message.error('文件夹名称不能为空');
        return Promise.reject();
      }

      const folderPathValue = `${folderPath.value + (folderPath.value === '/' ? '' : '/')}/${inputValue}`;

      return axios.post('/create-folder', { folderPath: folderPathValue })
        .then(() => {
          message.success('文件夹创建成功');
          fetchHtmlAndExtractImages(); // 触发刷新事件
        })
        .catch(error => {
          message.error('文件夹创建失败');
          console.error('Error creating folder:', error);
        });
    },
  });
};

// 编辑文件夹名称
const editFolderName = (oldName: string, index: number) => {
  let inputValue = oldName;

  Modal.confirm({
    title: '修改文件夹名称',
    content: h('Input', {
      id: 'edit-folder-name',
      defaultValue: oldName,
      placeholder: '请输入新的文件夹名称',
      onInput: (e: any) => inputValue = e.target.value
    }),
    onOk() {
      if (!inputValue) {
        message.error('文件夹名称不能为空');
        return Promise.reject();
      }

      const folderPathValue = `${folderPath.value + (folderPath.value === '/' ? '' : '/')}${oldName}`;
      const newFolderPathValue = `${folderPath.value + (folderPath.value === '/' ? '' : '/')}${inputValue}`;

      return axios.post('/edit-folder', { folderPath: folderPathValue, name: newFolderPathValue })
        .then(() => {
          message.success('文件夹名称修改成功' + inputValue);
          // folderLinks.value[index].name = inputValue;
          // folderLinks.value[index].url = appendToCurrentPath(inputValue);
          // console.log(folderLinks.value[index].url);
          fetchHtmlAndExtractImages(); // 触发刷新事件 直接触发刷新事件是会影响当前功能的，需要知道是哪个文件，自动修改
        })
        .catch(error => {
          message.error('文件夹名称修改失败');
          console.error('Error editing folder name:', error);
        });
    },
  });
};

function appendToCurrentPath(inputValue: string): string {
  // 获取当前网页的完整 URL
  const currentUrl = window.location.href;

  // 创建一个 URL 对象来解析当前 URL
  const url = new URL(currentUrl);

  // 获取当前路径名称（最后一个路径段）
  const currentPathName = url.pathname.split('/').filter(Boolean).pop();

  // 将当前路径名称与 inputValue 组合
  const newPathName = `${currentPathName}/${encodeURIComponent(inputValue)}`;

  // 更新 URL 对象中的路径
  url.pathname = url.pathname.replace(
    new RegExp(`${currentPathName}(\/|$)`),
    `${newPathName}/`
  );

  // 返回更新后的完整 URL
  return url.toString();
}

// 删除文件夹
const confirmDeleteFolder = (folderName: string, havePassword: boolean) => {
  Modal.confirm({
    title: '删除确认',
    content: `你确认要删除文件夹 ${folderName} 吗？`,
    onOk() {
      const folderPathValue = `${folderPath.value}/${folderName}`;

      let password = ""

      if (havePassword) {
        password = prompt("请输入密码") || "";
      }

      return axios.post('/delete-folder', { folderPath: folderPathValue, password })
        .then(() => {
          message.success('文件夹删除成功');
          fetchHtmlAndExtractImages(); // 触发刷新事件
        })
        .catch(error => {
          message.error('文件夹删除失败');
          console.error('Error deleting folder:', error);
        });
    },
  });
};

// 删除图片功能
const confirmDeleteImage = (imageName: string) => {
  Modal.confirm({
    title: '删除确认',
    content: `你确认要删除图片 ${imageName} 吗？`,
    onOk() {
      const imagePath = `${folderPath.value}/${imageName}`;
      return axios.post('/delete-files', { files: [imagePath] })
        .then(() => {
          message.success('图片删除成功');
          fetchHtmlAndExtractImages(); // 触发刷新事件
        })
        .catch(error => {
          message.error('图片删除失败');
          console.error('Error deleting image:', error);
        });
    },
  });
};

// 删除文件功能
const confirmDeleteFile = (fileName: string) => {
  Modal.confirm({
    title: '删除确认',
    content: `你确认要删除文件 ${fileName} 吗？`,
    onOk() {
      const filePath = `${folderPath.value}/${fileName}`;
      return axios.post('/delete-files', { files: [filePath] })
        .then(() => {
          message.success('文件删除成功');
          fetchHtmlAndExtractImages(); // 触发刷新事件
        })
        .catch(error => {
          message.error('文件删除失败');
          console.error('Error deleting file:', error);
        });
    },
  });
};

// 批量删除
const deleteSelectedImages = async () => {
  const selectedItems = new Set([...selectedImages.value, ...selectedFiles.value]);
  Modal.confirm({
    title: '删除确认',
    content: `你确认要删除选中的 ${selectedItems.size} 个文件吗？`,
    onOk() {
      const filesToDelete = Array.from(selectedItems).map(url => {
        const itemName = url.split('/').pop();
        const itemPath = `${folderPath.value}/${itemName}`;
        return itemPath;
      });

      axios.post('/delete-files', { files: filesToDelete })
        .then(() => {
          message.success('文件删除成功');
          fetchHtmlAndExtractImages();
        })
        .catch(error => {
          message.error('删除文件时出错');
          console.error('Error deleting files:', error);
        });
    },
  });
};

const sortOption = ref('name-asc');
// 排序功能
const sortItems = () => {
  if (isSortByFilesByTagMode.value && sortOption.value !== "date-asc-false" && sortOption.value !== "date-desc-false") {
    // 遍历 sortPanelData 并根据 sortOption 进行排序
    sortPanelData.value.forEach(panel => {
      if (sortOption.value === 'name-asc') {
        panel.list.imageUrls.sort((a, b) => a.name.localeCompare(b.name));
        panel.list.folderLinks.sort((a, b) => a.name.localeCompare(b.name));
        panel.list.otherFiles.sort((a, b) => a.name.localeCompare(b.name));
      } else if (sortOption.value === 'name-desc') {
        panel.list.imageUrls.sort((a, b) => b.name.localeCompare(a.name));
        panel.list.folderLinks.sort((a, b) => b.name.localeCompare(a.name));
        panel.list.otherFiles.sort((a, b) => b.name.localeCompare(a.name));
      } else if (sortOption.value === 'date-asc') {
        panel.list.imageUrls.sort((a, b) => a.lastModified - b.lastModified);
        panel.list.folderLinks.sort((a, b) => a.lastModified - b.lastModified);
        panel.list.otherFiles.sort((a, b) => a.lastModified - b.lastModified);
      } else if (sortOption.value === 'date-desc') {
        panel.list.imageUrls.sort((a, b) => b.lastModified - a.lastModified);
        panel.list.folderLinks.sort((a, b) => b.lastModified - a.lastModified);
        panel.list.otherFiles.sort((a, b) => b.lastModified - a.lastModified);
      }
    });
  } else {
    if (sortOption.value === 'name-asc') {
      imageUrls.value.sort((a, b) => a.name.localeCompare(b.name));
      folderLinks.value.sort((a, b) => a.name.localeCompare(b.name));
      otherFiles.value.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortOption.value === 'name-desc') {
      imageUrls.value.sort((a, b) => b.name.localeCompare(a.name));
      folderLinks.value.sort((a, b) => b.name.localeCompare(a.name));
      otherFiles.value.sort((a, b) => b.name.localeCompare(a.name));
    } else if (sortOption.value === 'date-asc' || sortOption.value === 'date-asc-false') {
      isSortByFilesByTagMode.value = sortOption.value === 'date-asc-false' ? false : true;
      imageUrls.value.sort((a, b) => a.lastModified - b.lastModified);
      folderLinks.value.sort((a, b) => a.lastModified - b.lastModified);
      otherFiles.value.sort((a, b) => a.lastModified - b.lastModified);
    } else if (sortOption.value === 'date-desc' || sortOption.value === 'date-desc-false') {
      isSortByFilesByTagMode.value = sortOption.value === 'date-desc-false' ? false : true;
      imageUrls.value.sort((a, b) => b.lastModified - a.lastModified);
      folderLinks.value.sort((a, b) => b.lastModified - a.lastModified);
      otherFiles.value.sort((a, b) => b.lastModified - a.lastModified);
    } else {
      // 默认排序或其他排序逻辑
    }
  }
};


// 设置密码
const setPassword = async () => {
  const filePaths = [...selectedFiles.value, ...selectedImages.value, ...selectedFold.value].map(filePath => filePath.replace(/https?:\/\/[^\/:]+(:\d+)?\//, ''));


  const password = prompt("请输入密码");

  if (password == null) {
    return;
  }

  try {
    const response = await axios.post('/set-password', {
      filePaths,
      password,
    });
    fetchHtmlAndExtractImages();
    alert('Password set successfully');
  } catch (error) {
    console.error('Error setting password:', error);
    alert('Failed to set password');
  }

  toggleSelectMode();
};

// 移除密码
const removePassword = async () => {
  const filePaths = [...selectedFiles.value, ...selectedImages.value, ...selectedFold.value].map(filePath => filePath.replace(/https?:\/\/[^\/:]+(:\d+)?\//, ''));

  console.log(filePaths);

  try {
    const response = await axios.post('/remove-password', {
      filePaths,
    });
    fetchHtmlAndExtractImages();
    alert('Password removed successfully');
  } catch (error) {
    console.error('Error removing password:', error);
    alert('Failed to remove password');
  }

  toggleSelectMode();
};

// 获取缩略图URL的方法
const getThumbnailUrl = (url: string): string => {
  // 解析URL
  const urlObject = new URL(url);

  // 添加或设置查询参数 thumbnail=true
  urlObject.searchParams.set('thumbnail', 'true');

  // 返回带有 thumbnail 参数的 URL
  return urlObject.toString();
};

// 当下拉选择的值变化，需要重新排序
watch(sortOption, sortItems, { flush: 'post', immediate: false });

// 用于存储滚动位置的对象（可以持久化到 localStorage 或 Vuex）
const scrollPositions = ref<Record<string, number>>({});

// 保存滚动位置
const saveScrollPosition = debounce(() => {
  const currentPath = route.fullPath;
  scrollPositions.value[currentPath] = window.scrollY;
  console.log(`Saved scroll position for ${currentPath}:`, window.scrollY);
}, 100); // 300ms 的防抖间隔

// 恢复滚动位置
const restoreScrollPosition = () => {
  const currentPath = route.fullPath;
  const savedPosition = scrollPositions.value[currentPath];
  if (savedPosition !== undefined) {
    window.scrollTo(0, savedPosition);
    console.log(`Restored scroll position for ${currentPath}:`, savedPosition);
  }
};

watch(() => route.params.folderPath, async (newPath) => {
  if (Array.isArray(newPath)) {
    newPath = newPath.join('/');
  }
  folderPath.value = '/' + newPath;

  await fetchHtmlAndExtractImages();
  await nextTick();
  setTimeout(() => {
    restoreScrollPosition();
    canSaveScrollPos.value = true;
  }, 200);
});

defineExpose({
  fetchHtmlAndExtractImages
});

// 首页
const HomeClick = () => {
  if (searchValue.value.length > 0) {
    searchValue.value = "";
    fetchHtmlAndExtractImages();
  }
  router.push('/')
}

onMounted(async () => {
  window.addEventListener("scroll", () => {
    if (canSaveScrollPos.value) {
      saveScrollPosition();
    }
  });

  try {
    const response = await axios.get('/get-tags');
    baseTags.value = response.data.tags; // 假设服务器返回的数据是包含标签的数组

    const storedPasswordMap = sessionStorage.getItem('currentPasswordMap');
    if (storedPasswordMap) {
      // 恢复存储在sessionStorage中的数据
      currentPasswordMap.value = JSON.parse(storedPasswordMap);
    }

    // const storedValue = localStorage.getItem('isSortByFilesByTagMode');
    // if (storedValue !== null) {
    //   isSortByFilesByTagMode.value = JSON.parse(storedValue);
    // }
  } catch (error) {
    console.error('Error fetching tags:', error);
  }
});

</script>

<template>
  <div class="document-list">
    <a-breadcrumb :style="{ backgroundColor: props.isDarkMode ? 'white' : 'inherit', marginBottom: '20px' }">
      <a-breadcrumb-item>
        <a @click.prevent="HomeClick" href="#">
          首页
        </a>
      </a-breadcrumb-item>
      <a-breadcrumb-item v-for="(segment, index) in folderPath.split('/').filter(Boolean)" :key="index">
        <template v-if="index === folderPath.split('/').filter(Boolean).length - 1">
          {{ segment }}
        </template>
        <template v-else>
          <a @click.prevent="router.push('/' + folderPath.split('/').filter(Boolean).slice(0, index + 1).join('/'))"
            href="#">{{ segment }}</a>
        </template>
      </a-breadcrumb-item>
    </a-breadcrumb>

    <a-divider />

    <div class="actions">
      <a-button class="a_button_class" :icon="h(CheckCircleOutlined)" @click="toggleSelectMode">{{ isSelectMode ? '取消选择'
        :
        '批量选择' }}</a-button>
      <a-button class="a_button_class" :icon="h(DeleteOutlined)"
        v-if="(selectedImages.size > 0 || selectedFiles.size > 0) && selectedFold.size === 0"
        style="color: #ff4d4f!important" danger @click="deleteSelectedImages">批量删除</a-button>
      <a-button v-if="!isSelectMode" class="a_button_class" :icon="h(EditOutlined)" @click="toggleEditMode">{{
        isEditMode ?
          '取消编辑' : '文件编辑'
      }}</a-button>
      <a-button class="a_button_class" :icon="h(DownloadOutlined)"
        v-if="(selectedImages.size > 0 || selectedFiles.size > 0) && selectedFold.size === 0"
        @click="downloadSelectedItems">下载选中的文件</a-button>

      <a-upload style="margin-right: 0px;" :before-upload="beforeUpload" :custom-request="uploadNextFile" multiple
        :show-upload-list="false" class="a_button_class">
        <a-button :icon="h(UploadOutlined)" class="a_button_class">
          上传文件
        </a-button>
      </a-upload>

      <a-button :icon="h(FolderAddOutlined)" class="a_button_class" @click="createFolder">
        创建文件夹
      </a-button>

      <a-select v-model:value="sortOption" style="width: 160px; margin-right: 10px;text-align: left;">
        <a-select-option value="name-asc">名称降序</a-select-option>
        <a-select-option value="name-desc">名称升序</a-select-option>
        <a-select-option value="date-asc">日期降序</a-select-option>
        <a-select-option value="date-desc">日期升序</a-select-option>
        <a-select-option value="date-asc-false">日期降序(无视标签)</a-select-option>
        <a-select-option value="date-desc-false">日期升序(无视标签)</a-select-option>
      </a-select>

      <a-dropdown trigger="click" v-if="selectedImages.size > 0 || selectedFiles.size > 0 || selectedFold.size > 0">
        <template #overlay>
          <div style="padding: 16px; background: white; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);">
            <a-input v-model:value="tagSearchValue" placeholder="创建或搜索标签" @keydown.enter="createTag" @click.stop
              style="width: 300px; margin-bottom: 14px;" />
            <div v-if="filteredTags.length > 0">
              <div v-for="tag in filteredTags" :key="tag.id" class="element-test" @click="selectTag(tag.id)" :style="{
                display: 'flex',
                alignItems: 'center',
                marginBottom: '4px',
                cursor: 'pointer',
                color: tag.id === '0' ? 'red' : ''
              }">
                {{ tag.name }}
              </div>
            </div>
            <div v-else>
              创建新标签 "{{ tagSearchValue }}"
              <div style="font-size: 12px; color: #0000004f;">(在输入框中按回车键即可创建)</div>
            </div>
          </div>
        </template>
        <a-button class="a_button_class" :icon="h(TagOutlined)">
          编辑标签
        </a-button>
      </a-dropdown>

      <!-- 设置颜色 -->
      <a-dropdown trigger="click" v-if="selectedImages.size > 0 || selectedFiles.size > 0 || selectedFold.size > 0">
        <template #overlay>
          <div style="padding: 16px; background: white; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);">
            <div>
              <div v-for="color in baseColors" :key="color" @click="setFileColor(color)"
                style="display: flex; align-items: center;  cursor: pointer; align-items: center;">
                <span
                  :style="{ backgroundColor: color, display: 'inline-block', width: '100px', height: '12px', marginRight: '8px', marginBottom: '12px' }">
                  <span v-if="color === '#ffffff'" :style="{ color: 'red' }">去除颜色</span>
                </span>
              </div>
            </div>
          </div>
        </template>
        <a-button class="a_button_class" :icon="h(BgColorsOutlined)">
          添加颜色
        </a-button>
      </a-dropdown>

      <template
        v-if="(selectedImages.size > 0 || selectedFiles.size > 0 || selectedFold.size > 0) && spinningStore.isInWhiteList">
        <a-button :icon="h(LockOutlined)" class="a_button_class" @click="setPassword()">
          为文件上锁
        </a-button>

        <a-button :icon="h(UnlockOutlined)" class="a_button_class" @click="removePassword()">
          为文件解锁
        </a-button>

        <Permissions :onSuccess="toggleSelectMode"
          :file-paths="[...selectedFiles, ...selectedImages, ...selectedFold]" />
      </template>
    </div>

    <div class="search-bar">
      <a-input-search v-model:value="searchValue" placeholder="（仅支持全局搜索）输入搜索文件目录或名称" style="width: 500px"
        @search="onSearch" />
    </div>
    <template v-if="isSortByFilesByTagMode" key="0">
      <div v-for="(panel, index) in sortPanelData" :key="panel.id" style="margin-bottom: 20px;">
        <!-- 显示分类的颜色和名称 -->
        <div style="display: flex;justify-content: centera;align-items: center;margin: 30px 0px 10px 0px;">
          <div
            style="display: flex; align-items: center;width: max-content; white-space: nowrap; padding-right: 10px;font-weight: 700;font-size: 20px">
            {{ panel.id === '0' ? "默认" : panel.name }}
          </div>
          <a-divider style="height: 2px;min-width: none;">
          </a-divider>
        </div>

        <!-- 渲染文件夹类型 -->
        <Folder :sortOption="sortOption" v-if="panel.list.folderLinks.length > 0" :folderLinks="panel.list.folderLinks"
          :isSelectMode="isSelectMode" :isEditMode="isEditMode" :selectedFold="selectedFold"
          :handleSelectFolds="handleSelectFolds" :navigateToFolder="navigateToFolder" :editFolderName="editFolderName"
          :confirmDeleteFolder="confirmDeleteFolder" />

        <!-- 渲染图片库类型 -->
        <Gallery :sortOption="sortOption" :loading="loading" v-if="panel.list.imageUrls.length > 0"
          :currentPassword="currentPassword" :imageUrls="panel.list.imageUrls" :isSelectMode="isSelectMode"
          :isEditMode="isEditMode" :selectedImages="selectedImages" :handleSelectImage="handleSelectImage"
          :getThumbnailUrl="getThumbnailUrl" :confirmDeleteImage="confirmDeleteImage" />

        <!-- 渲染其他文件类型 -->
        <OtherFile :sortOption="sortOption" v-if="panel.list.otherFiles.length > 0" :currentPassword="currentPassword"
          :otherFiles="panel.list.otherFiles" :isSelectMode="isSelectMode" :isEditMode="isEditMode"
          :selectedFiles="selectedFiles" :handleSelectFile="handleSelectFile" :confirmDeleteFile="confirmDeleteFile" />
      </div>
    </template>
    <template key="1" v-else>
      <!-- 文件夹类型 -->
      <Folder :sortOption="sortOption" :folderLinks="folderLinks" :isSelectMode="isSelectMode" :isEditMode="isEditMode"
        :selectedFold="selectedFold" :handleSelectFolds="handleSelectFolds" :navigateToFolder="navigateToFolder"
        :editFolderName="editFolderName" :confirmDeleteFolder="confirmDeleteFolder" />

      <!-- 图片库类型 -->
      <Gallery :sortOption="sortOption" :loading="loading" :imageUrls="imageUrls" :currentPassword="currentPassword"
        :isSelectMode="isSelectMode" :isEditMode="isEditMode" :selectedImages="selectedImages"
        :handleSelectImage="handleSelectImage" :getThumbnailUrl="getThumbnailUrl"
        :confirmDeleteImage="confirmDeleteImage" />

      <!-- 其他文件 -->
      <OtherFile :sortOption="sortOption" :currentPassword="currentPassword" :otherFiles="otherFiles"
        :isSelectMode="isSelectMode" :isEditMode="isEditMode" :selectedFiles="selectedFiles"
        :handleSelectFile="handleSelectFile" :confirmDeleteFile="confirmDeleteFile" />
    </template>
  </div>
</template>
