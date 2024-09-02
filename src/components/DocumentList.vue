<script setup lang="ts">
import { ref, watch, h, computed, onMounted } from 'vue';
import axios from 'axios';
import { useRoute, useRouter } from 'vue-router';
import { FolderOutlined, EditOutlined, DeleteOutlined, CheckCircleOutlined, UploadOutlined, FolderAddOutlined, FileOutlined, DownloadOutlined, TagOutlined } from '@ant-design/icons-vue';
import { Checkbox, Modal, message } from 'ant-design-vue';
// @ts-ignore
import { saveAs } from 'file-saver';
import { useSpinningStore } from '../stores/spinningStore';
import './DocumentList.css'; // 引入外部 CSS 文件

const baseUrl = window.location.origin + '/'; // 动态获取当前网页的 base URL
const validImageExtensions = ['.jpeg', '.jpg', '.png', '.gif', '.webp'];

const route = useRoute();
const router = useRouter();
const spinningStore = useSpinningStore();

const props = defineProps<{ isDarkMode: boolean }>();

type TypeTagColor = { color: string, name: string, id: string }
const baseTags = ref<TypeTagColor[]>([]);
const tagSearchValue = ref('');
const selectedColor = ref('');
// 计算属性，动态过滤tags
const filteredTags = computed(() => {
  return baseTags.value.filter(tag => tag.name.toLowerCase().includes(tagSearchValue.value.toLowerCase()));
});
const selectColor = (color: string) => {
  selectedColor.value = color;
};
// 创建标签
const createTag = async () => {
  if (filteredTags.value.length !== 0) {
    return;
  }
  if (!selectedColor.value) {
    alert('请选择一个标签颜色');
    return;
  }
  if (tagSearchValue.value.trim()) {
    const newTag = {
      color: selectedColor.value,
      name: tagSearchValue.value.trim(),
      id: Date.now().toString() // 生成唯一的ID
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

// 设置标签
const selectTag = async (id: string) => {
  const tag = baseTags.value.find(tag => tag.id === id);
  const filesToTag = [...selectedFiles.value, ...selectedImages.value].map(filePath => ({
    path: filePath.replace(/https?:\/\/[^\/:]+(:\d+)?\//, ''),  // 移除URL前缀，匹配带端口号的路径
    tag
  }));

  try {
    await axios.post('/set-tags', { files: filesToTag });
    console.log('Tags set successfully for selected files');
    message.success("设置成功");
    selectOtherFileIndex.value.forEach((index: number) => {
      otherFiles.value[index].tag = tag;
    })
    selectImageIndex.value.forEach((index: number) => {
      imageUrls.value[index].tag = tag;
    })

    console.log(otherFiles.value, imageUrls.value);

    selectOtherFileIndex.value = [];
    selectImageIndex.value = [];

    selectedFiles.value.clear();
    selectedImages.value.clear();
    toggleSelectMode();
  } catch (error) {
    console.error('Error setting tags:', error);
  }
};

// 查询标签
const fetchTags = async (files: TypeFile[]) => {
  // 获取路径数组并移除URL前缀
  const paths = files.map(image => image.url.replace(/https?:\/\/[^\/:]+(:\d+)?\//, ''));

  try {
    // 发送请求获取标签信息
    const response = await axios.post('/get-tags-from-file', { paths });

    // 更新每个imageUrls中的标签信息
    files.forEach((image, index) => {
      image.tag = response.data[index]; // 将返回的标签设置到对应的image
    });

    return Promise.resolve();
  } catch (error) {
    console.error('Error fetching tags:', error);
    return Promise.reject();
  }
};

type TypeFile = { url: string, name: string, lastModified: number, fileSize: string, lastModifiedText?: string, tag?: TypeTagColor };
const imageUrls = ref<TypeFile[]>([]);
const folderLinks = ref<TypeFile[]>([]);
const otherFiles = ref<TypeFile[]>([]);

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

    // @ts-ignore
    imageUrls.value = data.image;
    folderLinks.value = data.fold;
    otherFiles.value = data.other;
  }).catch((e) => {
    message.error('没有找到相关文件或文件夹');
    console.log(e);
  }).finally(() => {
    spinningStore.toggleSpinning();
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
  // 提取日、月、年和时间部分
  const [datePart, timePart] = dateString.split(' ');
  const [day, month, year] = datePart.split('-');
  const monthEnglish = month;

  // 构建有效的日期字符串
  const formattedDateString = `${day} ${monthEnglish} ${year} ${timePart}`;
  return new Date(formattedDateString).getTime();
};

// 获取文件列表
let timeoutId: any; // 用于存储 setInterval 的 ID
let currentLinks: any[] = []; // 存储当前的链接列表

const fetchHtmlAndExtractImages = async (): Promise<void> => {
  searchValue.value = "";
  folderLinks.value = [];
  imageUrls.value = [];
  otherFiles.value = [];
  selectedImages.value.clear();
  selectedFiles.value.clear();
  currentLinks = [];

  if (timeoutId) {
    clearInterval(timeoutId);
  }

  try {
    const curUrl = `${IMAGE_BASE_URL}${folderPath.value}`;
    const response = await axios.get(curUrl);
    const html = response.data;

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
        // 直接修改原对象指针
        fetchTags(nextBatch).then(() => {
          console.log(nextBatch);
          imageUrls.value.push(...nextBatch);
          index += batchSize;
          timeoutId = setTimeout(fn(), 300);
        });
      } else {
        // clearInterval(intervalId); // 所有数据推送完成后清除 interval
      }
      return fn;
    };
    let index = 0;
    fn();

    sortItems(); // 加载数据后进行排序
  } catch (error) {
    console.error('Error fetching HTML:', error);
  }
};

// 导航到指定文件夹
const navigateToFolder = (folderName: string) => {
  router.push(`${folderPath.value}${folderPath.value === '/' ? '' : '/'}${folderName}`);
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

onMounted(async () => {
  try {
    const response = await axios.get('/get-tags');
    baseTags.value = response.data.tags; // 假设服务器返回的数据是包含标签的数组
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
        v-if="selectedImages.size > 0 || selectedFiles.size > 0" style="color: #ff4d4f!important" danger
        @click="deleteSelectedImages">批量删除</a-button>
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

      <a-select v-model:value="sortOption" style="width: 110px; margin-right: 10px;">
        <a-select-option value="name-asc">名称降序</a-select-option>
        <a-select-option value="name-desc">名称升序</a-select-option>
        <a-select-option value="date-asc">日期降序</a-select-option>
        <a-select-option value="date-desc">日期升序</a-select-option>
      </a-select>

      <a-dropdown trigger="click" v-if="selectedImages.size > 0 || selectedFiles.size > 0">
        <template #overlay>
          <div style="padding: 16px; background: white; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);">
            <a-input v-model:value="tagSearchValue" placeholder="创建或搜索标签" @keydown.enter="createTag" @click.stop
              style="width: 300px; margin-bottom: 14px;" />
            <div v-if="filteredTags.length > 0">
              <div v-for="tag in filteredTags" :key="tag.id" @click="selectTag(tag.id)"
                style="display: flex; align-items: center; margin-bottom: 4px; cursor: pointer;">
                <span
                  :style="{ backgroundColor: tag.color, display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', marginRight: '8px' }"></span>
                {{ tag.name }}
              </div>
            </div>
            <div v-else>
              创建新标签 "{{ tagSearchValue }}"
              <div style="font-size: 12px; color: #0000004f">(在输入框中按回车键即可创建，点击下方选择标签颜色)</div>
              <!-- 选择标签的颜色 -->
              <div style="display: flex; align-items: center; margin-top: 8px;">
                <div @click.stop v-for="tag in baseTags" :key="tag.id" @click="selectColor(tag.color)"
                  :style="{ backgroundColor: tag.color, display: 'inline-block', width: '20px', height: '20px', borderRadius: '50%', marginRight: '8px', cursor: 'pointer', border: selectedColor === tag.color ? '2px solid rgb(0 0 0 / 49%)' : 'none' }">
                </div>
              </div>
            </div>
          </div>
        </template>
        <a-button class="a_button_class" :icon="h(TagOutlined)">
          编辑标签
        </a-button>
      </a-dropdown>
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
          <!-- <a-button v-if="isEditMode" type="link" style="color: #30fb00" :icon="h(PushpinOutlined)"
            @click="HighLightDocs(folder.url)" /> -->
          <a-button v-if="isEditMode" type="link" :icon="h(EditOutlined)" @click="editFolderName(folder.name)" />
          <a-button v-if="isEditMode" type="link" danger :icon="h(DeleteOutlined)"
            @click="confirmDeleteFolder(folder.name)" />
        </div>
      </div>
    </div>

    <div class="gallery">
      <a-image-preview-group>
        <div v-for="(item, index) in imageUrls" :key="item.url" class="image-wrapper"
          @click="(isSelectMode || isEditMode) ? handleSelectImage(item.url, !selectedImages.has(item.url), index) : null">
          <div class="image-container">
            <Checkbox v-if="isSelectMode" @change="(e: any) => handleSelectImage(item.url, e.target.checked, index)"
              class="image-checkbox" :checked="selectedImages.has(item.url)" />

            <!-- 如果是选择模式，则显示缩略图，否则显示大图 -->
            <a-image :src="getThumbnailUrl(item.url)" width="200px"
              :preview="(isSelectMode || isEditMode) ? false : { src: item.url }" />

            <div class="image-name">{{ item.name }}</div>
            <div class="image-name">{{ item.lastModifiedText }}</div>
            <div v-if="item.tag?.id && item.tag?.id !== '0'" class="image-name" style="display: flex;justify-content: center;align-items: center;">
              <span
                :style="{ backgroundColor: item.tag?.color, display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', marginRight: '8px' }"></span>
              {{ item.tag?.name }}
            </div>
            <div v-if="isEditMode" class="delete-button">
              <a-button type="link" danger :icon="h(DeleteOutlined)" @click="confirmDeleteImage(item.name)" />
            </div>
          </div>
        </div>
      </a-image-preview-group>
    </div>

    <div v-if="otherFiles.length > 0" style="text-align: left;margin-top: 30px;">其他文件</div>
    <div class="other-files">
      <div v-for="(file, index) in otherFiles" :key="file.url" class="file-wrapper"
        @click="isSelectMode ? handleSelectFile(file.url, !selectedFiles.has(file.url), index) : null">
        <div class="file-container">
          <Checkbox v-if="isSelectMode" @change="(e: any) => handleSelectFile(file.url, e.target.checked, index)"
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
