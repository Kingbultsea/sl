<script setup lang="ts">
import { ref, watch, h } from 'vue';
import axios from 'axios';
import { useRoute, useRouter } from 'vue-router';
import { FolderOutlined, EditOutlined, DeleteOutlined, CheckCircleOutlined, UploadOutlined, FolderAddOutlined } from '@ant-design/icons-vue';
import { Checkbox, Modal, message } from 'ant-design-vue';
// @ts-ignore
import { saveAs } from 'file-saver';

const route = useRoute();
const router = useRouter();

const imageUrls = ref<{ url: string, name: string, lastModified: Date }[]>([]);
const folderLinks = ref<{ url: string, name: string, lastModified: Date }[]>([]);
const selectedImages = ref<Set<string>>(new Set());
const isSelectMode = ref(false);
const isEditMode = ref(false);
const folderPath = ref(route.params.folderPath as String || '/');
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

const parseDate = (dateString: string) => {
  // 提取日、月、年和时间部分
  const [datePart, timePart] = dateString.split(' ');
  const [day, month, year] = datePart.split('-');
  const monthEnglish = monthMap[month];

  // 构建有效的日期字符串
  const formattedDateString = `${day} ${monthEnglish} ${year} ${timePart}`;
  return new Date(formattedDateString);
};

// 获取文件列表
const fetchHtmlAndExtractImages = async () => {
  folderLinks.value = [];
  imageUrls.value = [];
  selectedImages.value.clear();
  isSelectMode.value = false;
  isEditMode.value = false;

  try {
    const curUrl = `${IMAGE_BASE_URL}${folderPath.value}`;
    const response = await axios.get(curUrl);
    const html = response.data;

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const links = doc.querySelectorAll('.display-name a');
    const dates = doc.querySelectorAll('.last-modified');

    const validImageExtensions = ['.jpeg', '.jpg', '.png', '.gif'];

    links.forEach((link, index) => {
      let fileName = link.textContent?.trim();
      const lastModifiedText = dates[index].textContent?.trim();
      const lastModified = parseDate(lastModifiedText!);

      console.log(lastModified, lastModifiedText);

      if (fileName!.endsWith('/')) {
        if (fileName !== '../') {
          fileName = fileName?.replace(/\/$/, ''); // 去除末尾的斜杠
          folderLinks.value.push({ url: curUrl + fileName, name: fileName!, lastModified });
        }
      } else {
        const extension = fileName!.split('.').pop()?.toLowerCase();
        if (validImageExtensions.includes(`.${extension}`)) {
          imageUrls.value.push({ url: curUrl + '/' + fileName, name: fileName!, lastModified });
        }
      }
    });

    sortItems(); // 加载数据后进行排序
  } catch (error) {
    console.error('Error fetching HTML:', error);
  }
};

// 导航到指定文件夹
const navigateToFolder = (folderName: string) => {
  router.push(`${folderPath.value}${folderPath.value === '/' ? '' : '/' }${folderName}`);
};

// 批量选择
const handleSelectImage = (url: string, checked: boolean) => {
  if (checked) {
    selectedImages.value.add(url);
  } else {
    selectedImages.value.delete(url);
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
const downloadSelectedImages = () => {
  Modal.confirm({
    title: '下载确认',
    content: `你确认要下载选中的 ${selectedImages.value.size} 张图片吗？`,
    onOk() {
      selectedImages.value.forEach(async (url) => {
        const response = await fetch(url);
        const blob = await response.blob();
        saveAs(blob, url.split('/').pop()!);
      });
    },
  });
};

const fileQueue = ref<any[]>([]);
const isUploading = ref(false);

const beforeUpload = (file: any) => {
  fileQueue.value.push(file);
  if (!isUploading.value) {
    uploadNextFile();
  }
  return false; // 手动处理上传事件
};

// 处理批量上传功能
const uploadNextFile = async () => {
  if (fileQueue.value.length === 0) {
    isUploading.value = false;
    setTimeout(() => {
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
      message.success(`${file.name} uploaded successfully`);
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
      return axios.post('/delete-files', { files: [ imagePath ] })
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

// 批量删除
const deleteSelectedImages = async () => {
  Modal.confirm({
    title: '删除确认',
    content: `你确认要删除选中的 ${selectedImages.value.size} 张图片吗？`,
    onOk() {
      const filesToDelete = Array.from(selectedImages.value).map(url => {
        const imageName = url.split('/').pop();
        const imagePath = `${folderPath.value}/${imageName}`;
        return imagePath;
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
  } else if (sortOption.value === 'name-desc') {
    imageUrls.value.sort((a, b) => b.name.localeCompare(a.name));
    folderLinks.value.sort((a, b) => b.name.localeCompare(a.name));
  } else if (sortOption.value === 'date-asc') {
    // @ts-ignore
    imageUrls.value.sort((a, b) => a.lastModified - b.lastModified);
     // @ts-ignore
    folderLinks.value.sort((a, b) => a.lastModified - b.lastModified);
  } else if (sortOption.value === 'date-desc') {
     // @ts-ignore
    imageUrls.value.sort((a, b) => b.lastModified - a.lastModified);
     // @ts-ignore
    folderLinks.value.sort((a, b) => b.lastModified - a.lastModified);
  } else {
    // 默认排序或其他排序逻辑
  }
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

</script>

<template>
  <div>
    <a-breadcrumb style="margin-bottom: 20px;">
      <a-breadcrumb-item>
        <a @click.prevent="router.push('/')" href="#">
          首页
        </a>
      </a-breadcrumb-item>
      <a-breadcrumb-item v-for="(segment, index) in folderPath.split('/').filter(Boolean)" :key="index">
        <template v-if="index === folderPath.split('/').filter(Boolean).length - 1">
          {{ segment }}
        </template>
        <template v-else>
          <a @click.prevent="router.push('/' + folderPath.split('/').filter(Boolean).slice(0, index + 1).join('/'))" href="#">{{ segment }}</a>
        </template>
      </a-breadcrumb-item>
    </a-breadcrumb>

    <a-divider />

    <div class="actions">
      <a-button class="a_button_class" :icon="h(CheckCircleOutlined)" @click="toggleSelectMode">{{ isSelectMode ? '取消选择' : '批量选择' }}</a-button>
      <a-button class="a_button_class" v-if="selectedImages.size > 0" danger @click="deleteSelectedImages">批量删除</a-button>
      <a-button class="a_button_class" :icon="h(EditOutlined)" @click="toggleEditMode">{{ isEditMode ? '取消编辑' : '文件编辑' }}</a-button>
      <a-button class="a_button_class" v-if="selectedImages.size > 0" @click="downloadSelectedImages">下载选中的图片</a-button>

      <a-upload
        style="margin-right: 0px;"
        :before-upload="beforeUpload"
        :custom-request="uploadNextFile"
        multiple
        :show-upload-list="false"
        class="a_button_class"
      >
        <a-button :icon="h(UploadOutlined)" class="a_button_class">
          上传图片
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

    <div class="folders" v-if="folderLinks.length > 0">
      <div v-for="folder in folderLinks" :key="folder.url" class="folder-container">
        <a @click.prevent="navigateToFolder(folder.name)" href="#">
          <FolderOutlined class="folder-icon" />
          <span class="folder-name">{{ folder.name }}</span>
        </a>
        <div>
          <a-button v-if="isEditMode" type="link" :icon="h(EditOutlined)" @click="editFolderName(folder.name)" />
          <a-button v-if="isEditMode" type="link" danger :icon="h(DeleteOutlined)" @click="confirmDeleteFolder(folder.name)" />
        </div>
      </div>
    </div>

    <div class="gallery">
      <div v-for="item in imageUrls" :key="item.url" class="image-wrapper" @click="isSelectMode ? handleSelectImage(item.url, !selectedImages.has(item.url)) : null">
        <div class="image-container">
          <Checkbox v-if="isSelectMode" @change="(e) => handleSelectImage(item.url, e.target.checked)" class="image-checkbox" :checked="selectedImages.has(item.url)" />
          <a-image :src="item.url" width="200px" :preview="!isSelectMode" />
          <div class="image-name">{{ item.name }}</div>
          <div v-if="isEditMode" class="delete-button">
            <a-button type="link" danger :icon="h(DeleteOutlined)" @click="confirmDeleteImage(item.name)" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>


<style scoped>
.folders, .gallery {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.a_button_class {
  color: inherit !important;
  background: inherit;
  margin-right: 10px;
}

.delete-button {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 2;
}

.folders {
  margin-bottom: 20px;
}

.folder-container {
  display: flex;
  align-items: center;
  width: 240px;
  box-sizing: border-box;
  justify-content: space-between;
  padding: 1em;
  border: 1px solid #ddd;
  border-radius: 8px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  text-decoration: none;
}

.folder-container:hover {
  transform: scale(1.05);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
}

.folder-icon {
  font-size: 2em;
  margin-right: 10px;
  color: #ffb74d;
}

.folder-name {
  font-size: 1em;
}

.image-wrapper {
  position: relative;
}

.image-container {
  position: relative;
  width: 200px;
  overflow: hidden;
  border: 1px solid #ddd;
  border-radius: 8px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  cursor: pointer; /* Add cursor to indicate clickability */
}

.image-container:hover {
  transform: scale(1.05);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
}

.image-checkbox {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 1;
}

img {
  width: 100%;
  height: auto;
  object-fit: cover;
}

.image-name {
  position: absolute;
  bottom: 0;
  width: 100%;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  text-align: center;
  padding: 5px 0;
  opacity: 1;
  transition: opacity 0.3s ease;
}

.image-wrapper:hover .image-name {
  opacity: 1;
}

.actions {
  display: flex;
  margin-bottom: 20px;
}

</style>
