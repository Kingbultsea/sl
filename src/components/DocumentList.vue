<script setup lang="ts">
import { ref, watch, h } from 'vue';
import axios from 'axios';
import { useRoute, useRouter } from 'vue-router';
import { FolderOutlined, EditOutlined, DeleteOutlined, CheckCircleOutlined, UploadOutlined, FolderAddOutlined, FileOutlined, DownloadOutlined, PushpinOutlined } from '@ant-design/icons-vue';
import { Checkbox, Modal, message } from 'ant-design-vue';
// @ts-ignore
import { saveAs } from 'file-saver';
import { useSpinningStore } from '../stores/spinningStore';
import './DocumentList.css'; // 引入外部 CSS 文件

const validImageExtensions = ['.jpeg', '.jpg', '.png', '.gif', '.webp'];

const route = useRoute();
const router = useRouter();
const spinningStore = useSpinningStore();

const props = defineProps<{ isDarkMode: boolean }>();


const imageUrls = ref<{ url: string, name: string, lastModified: Date, fileSize: string, lastModifiedText?: string }[]>([]);
const folderLinks = ref<{ url: string, name: string, lastModified: Date, fileSize: string, lastModifiedText?: string }[]>([]);
const otherFiles = ref<{ url: string, name: string, lastModified: Date, fileSize: string, lastModifiedText?: string }[]>([]);

const selectedImages = ref<Set<string>>(new Set());
const selectedFiles = ref<Set<string>>(new Set());
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
  }).then(({ data }) => {

    // Files found: [
    //   '_0003_walk_22 (4).png',
    //   'protected/_0003_walk_22 (3).png',
    //   '1222/123/_0003_walk_22 (2).png',
    //   '1222/123/_0003_walk_22 (3).png'
    // ]

    // @ts-ignore
    imageUrls.value = data.image;
    folderLinks.value = data.fold;
    otherFiles.value = data.other;
  }).catch(() => {
    message.error('没有找到相关文件或文件夹');
  }).finally(() => {
    spinningStore.toggleSpinning();
  });
};
const IMAGE_BASE_URL = import.meta.env.VITE_IMAGE_BASE_URL;

const monthMap: any = {
  '1月': 'Jan',
  '2月': 'Feb',
  '3月': 'Mar',
  '4月': 'Apr',
  '5月': 'May',
  '6月': 'Jun',
  '7月': 'Jul',
  '8月': 'Aug',
  '9月': 'Sep',
  '10月': 'Oct',
  '11月': 'Nov',
  '12月': 'Dec'
};

const parseDateFormat2 = (date: Date) => {

  // 定义选项以进行日期和时间格式化
  const options = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false // 使用24小时制
  };

  // 使用 Intl.DateTimeFormat 进行格式化
  // @ts-ignore
  const formatter = new Intl.DateTimeFormat('zh-CN', options);


  const formattedDate = formatter.format(date);

  // 输出结果
  return formattedDate;

}

const parseDate = (dateString: string) => {
  // 提取日、月、年和时间部分
  const [datePart, timePart] = dateString.split(' ');
  const [day, month, year] = datePart.split('-');
  const monthEnglish = month;

  // 构建有效的日期字符串
  const formattedDateString = `${day} ${monthEnglish} ${year} ${timePart}`;
  return new Date(formattedDateString);
};

// 获取文件列表
let intervalId: any; // 用于存储 setInterval 的 ID
let currentLinks: any[] = []; // 存储当前的链接列表

const fetchHtmlAndExtractImages = async (): Promise<void> => {
  searchValue.value = "";
  folderLinks.value = [];
  imageUrls.value = [];
  otherFiles.value = [];
  selectedImages.value.clear();
  selectedFiles.value.clear();
  currentLinks = [];

  if (intervalId) {
    clearInterval(intervalId);
  }

  try {
    const curUrl = `${IMAGE_BASE_URL}${folderPath.value}`;
    const response = await axios.get(curUrl);
    // const auth = await axios.get(`${IMAGE_BASE_URL}/check-auth`).then((data) => {
    //   console.log(data)
    //   return true
    // }).catch(e => {
    //   return false;
    // });
    const html = response.data;

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const links = doc.querySelectorAll('.display-name a');
    const dates = doc.querySelectorAll('.last-modified');
    const sizes = doc.querySelectorAll('.file-size code'); // 获取文件大小的元素

    links.forEach((link, index) => {
      let fileName = link.textContent?.trim();
      const lastModifiedText = dates[index].textContent?.trim();
      const lastModified = parseDate(lastModifiedText!);

      const fileSize = sizes[index].textContent?.trim() || '0'; // 获取文件大小

      // console.log(fileName!.startsWith('protected'));
      //  (!fileName!.startsWith('protected')

      if (fileName!.endsWith('/')) {
        if (fileName !== '../') {
          fileName = fileName?.replace(/\/$/, ''); // 去除末尾的斜杠
          folderLinks.value.push({ url: curUrl + fileName, name: fileName!, lastModified, fileSize, lastModifiedText });
        }
      } else {
        const extension = fileName!.split('.').pop()?.toLowerCase();
        if (validImageExtensions.includes(`.${extension}`)) {
          currentLinks.push({ url: curUrl + '/' + fileName, name: fileName!, lastModified, fileSize, lastModifiedText });
        } else {
          otherFiles.value.push({ url: curUrl + '/' + fileName, name: fileName!, lastModified, fileSize, lastModifiedText });
        }
      }
    });

    // 定时推送数据到 imageUrls，每0.5秒推送10个数据
    const fn = () => {
      const batchSize = 40; // 每次推送的数量
      if (index < currentLinks.length) {
        const nextBatch = currentLinks.slice(index, index + batchSize);
        imageUrls.value.push(...nextBatch);
        index += batchSize;
      } else {
        clearInterval(intervalId); // 所有数据推送完成后清除 interval
      }
      return fn;
    };
    let index = 0;
    intervalId = setInterval(fn(), 300);

    sortItems(); // 加载数据后进行排序
  } catch (error) {
    console.error('Error fetching HTML:', error);
  }
};

// 导航到指定文件夹
const navigateToFolder = (folderName: string) => {
  router.push(`${folderPath.value}${folderPath.value === '/' ? '' : '/'}${folderName}`);
};

// 批量选择
const handleSelectImage = (url: string, checked: boolean) => {
  if (checked) {
    selectedImages.value.add(url);
  } else {
    selectedImages.value.delete(url);
  }
};

const handleSelectFile = (url: string, checked: boolean) => {
  if (checked) {
    selectedFiles.value.add(url);
  } else {
    selectedFiles.value.delete(url);
  }
};

// 切换选择模式
const toggleSelectMode = () => {
  isSelectMode.value = !isSelectMode.value;
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

// 高亮文件夹
const HighLightDocs = (folderPath: string) => {

  // 发送给服务器
  axios.post('/highlight-folder', { folderPath })
    .then(() => {
      message.success('高亮文件成功');
    })
    .catch(error => {
      message.error('高亮文件失败');
    });
}

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
const editFolderName = (oldName: string) => {
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
          message.success('文件夹名称修改成功');
          fetchHtmlAndExtractImages(); // 触发刷新事件
        })
        .catch(error => {
          message.error('文件夹名称修改失败');
          console.error('Error editing folder name:', error);
        });
    },
  });
};

// 删除文件夹
const confirmDeleteFolder = (folderName: string) => {
  Modal.confirm({
    title: '删除确认',
    content: `你确认要删除文件夹 ${folderName} 吗？`,
    onOk() {
      const folderPathValue = `${folderPath.value}/${folderName}`;
      return axios.post('/delete-folder', { folderPath: folderPathValue })
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
  if (sortOption.value === 'name-asc') {
    imageUrls.value.sort((a, b) => a.name.localeCompare(b.name));
    folderLinks.value.sort((a, b) => a.name.localeCompare(b.name));
    otherFiles.value.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sortOption.value === 'name-desc') {
    imageUrls.value.sort((a, b) => b.name.localeCompare(a.name));
    folderLinks.value.sort((a, b) => b.name.localeCompare(a.name));
    otherFiles.value.sort((a, b) => b.name.localeCompare(a.name));
  } else if (sortOption.value === 'date-asc') {
    // @ts-ignore
    imageUrls.value.sort((a, b) => a.lastModified - b.lastModified);
    // @ts-ignore
    folderLinks.value.sort((a, b) => a.lastModified - b.lastModified);
    // @ts-ignore
    otherFiles.value.sort((a, b) => a.lastModified - b.lastModified);
  } else if (sortOption.value === 'date-desc') {
    // @ts-ignore
    imageUrls.value.sort((a, b) => b.lastModified - a.lastModified);
    // @ts-ignore
    folderLinks.value.sort((a, b) => b.lastModified - a.lastModified);
    // @ts-ignore
    otherFiles.value.sort((a, b) => b.lastModified - a.lastModified);
  } else {
    // 默认排序或其他排序逻辑
  }
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

watch(() => route.params.folderPath, (newPath) => {
  if (Array.isArray(newPath)) {
    newPath = newPath.join('/');
  }
  folderPath.value = '/' + newPath;
  fetchHtmlAndExtractImages();
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
        v-if="selectedImages.size > 0 || selectedFiles.size > 0" danger @click="deleteSelectedImages">批量删除</a-button>
      <a-button class="a_button_class" :icon="h(EditOutlined)" @click="toggleEditMode">{{ isEditMode ? '取消编辑' : '文件编辑'
        }}</a-button>
      <a-button class="a_button_class" :icon="h(DownloadOutlined)"
        v-if="selectedImages.size > 0 || selectedFiles.size > 0" @click="downloadSelectedItems">下载选中的文件</a-button>

      <a-upload style="margin-right: 0px;" :before-upload="beforeUpload" :custom-request="uploadNextFile" multiple
        :show-upload-list="false" class="a_button_class">
        <a-button :icon="h(UploadOutlined)" class="a_button_class">
          上传文件
        </a-button>
      </a-upload>

      <a-button :icon="h(FolderAddOutlined)" class="a_button_class" @click="createFolder">
        创建文件夹
      </a-button>

      <a-select v-model:value="sortOption" style="width: 110px; margin-right: 0px;">
        <a-select-option value="name-asc">名称降序</a-select-option>
        <a-select-option value="name-desc">名称升序</a-select-option>
        <a-select-option value="date-asc">日期降序</a-select-option>
        <a-select-option value="date-desc">日期升序</a-select-option>
      </a-select>
    </div>

    <div class="search-bar">
      <a-input-search v-model:value="searchValue" placeholder="（仅支持全局搜索）输入搜索文件目录或名称" style="width: 500px"
        @search="onSearch" />
    </div>

    <!-- 文件夹 -->
    <div class="folders" v-if="folderLinks.length > 0">
      <div v-for="folder in folderLinks" :key="folder.url" class="folder-container">
        <a @click.prevent="navigateToFolder(folder.name)" href="#">
          <FolderOutlined class="folder-icon" />
          <span class="folder-name">{{ folder.name }}</span>
        </a>
        <div>
          <a-button v-if="isEditMode" type="link" style="color: #30fb00" :icon="h(PushpinOutlined)"
            @click="HighLightDocs(folder.url)" />
          <a-button v-if="isEditMode" type="link" :icon="h(EditOutlined)" @click="editFolderName(folder.name)" />
          <a-button v-if="isEditMode" type="link" danger :icon="h(DeleteOutlined)"
            @click="confirmDeleteFolder(folder.name)" />
        </div>
      </div>
    </div>

    <div class="gallery">
      <a-image-preview-group>
        <div v-for="item in imageUrls" :key="item.url" class="image-wrapper"
          @click="isSelectMode ? handleSelectImage(item.url, !selectedImages.has(item.url)) : null">
          <div class="image-container">
            <Checkbox v-if="isSelectMode" @change="(e) => handleSelectImage(item.url, e.target.checked)"
              class="image-checkbox" :checked="selectedImages.has(item.url)" />

            <!-- 如果是选择模式，则显示缩略图，否则显示大图 -->
            <a-image :src="getThumbnailUrl(item.url)" width="200px" :preview="isSelectMode ? false : { src: item.url }" />

            <div class="image-name">{{ item.name }}</div>
            <div class="image-name">{{ item.lastModifiedText }}</div>
            <div v-if="isEditMode" class="delete-button">
              <a-button type="link" danger :icon="h(DeleteOutlined)" @click="confirmDeleteImage(item.name)" />
            </div>
          </div>
        </div>
      </a-image-preview-group>
    </div>

    <div v-if="otherFiles.length > 0" style="text-align: left;margin-top: 30px;">其他文件</div>
    <div class="other-files">
      <div v-for="file in otherFiles" :key="file.url" class="file-wrapper"
        @click="isSelectMode ? handleSelectFile(file.url, !selectedFiles.has(file.url)) : null">
        <div class="file-container">
          <Checkbox v-if="isSelectMode" @change="(e) => handleSelectFile(file.url, e.target.checked)"
            class="file-checkbox" :checked="selectedFiles.has(file.url)" />
          <div style="display: flex; align-items: center;margin-bottom: 10px;">
            <FileOutlined class="file-icon" />
            <div>{{ file.fileSize }}</div>
          </div>

          <a type="link" style="color: #1677ff" :href="file.url" target="_blank">下载</a>
          <div class="file-name">{{ file.name }}</div>
          <div class="file-name">{{ file.lastModifiedText }}</div>
          <div v-if="isEditMode" class="delete-button" style="top: 0px">
            <a-button type="link" danger :icon="h(DeleteOutlined)" @click="confirmDeleteFile(file.name)" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
