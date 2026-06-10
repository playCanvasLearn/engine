
# 生成缩略图

const MIN_LOADING_MS = 3000; 最小loading时间改成0，不然缩略图都是加载中

### 生成缩略图
手动删除对应的两个文件（例如 scene_mes-worker_large.webp / scene_mes-worker_small.webp ）
npm run build:thumbnails

### 生成缩略图并清空

npm run build:thumbnails -- --clean

### 生成缩略图debug
npm run build:thumbnails -- --debug
