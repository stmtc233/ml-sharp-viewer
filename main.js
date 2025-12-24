import * as THREE from 'three';
import { Viewer, SceneFormat } from '@mkkellogg/gaussian-splats-3d';

// 获取DOM元素
const container = document.getElementById('container');
const fileInput = document.getElementById('fileInput');
const loadingDiv = document.getElementById('loading');
const resetBtn = document.getElementById('resetViewBtn');
const zAxisSlider = document.getElementById('zAxisSlider');
const zAxisValue = document.getElementById('zAxisValue');
const toggleUiBtn = document.getElementById('toggleUiBtn');
const uiPanel = document.getElementById('ui');

// 切换菜单显示/隐藏
toggleUiBtn.addEventListener('click', () => {
    uiPanel.classList.toggle('hidden');
});

// 初始化 Viewer
// sharedMemoryForWorkers: false 为了兼容性更强，如果需要更高性能可以开启并配置服务器Headers
const viewer = new Viewer({
    'cameraUp': [0, 1, 0],
    'initialCameraPosition': [0, 0, 5],
    'rootElement': container,
    'sharedMemoryForWorkers': false,
    'useBuiltInControls': true,
});

// 启动 viewer
viewer.start();

// 设置控制器限制 (针对 2.5D 内容优化)
if (viewer.controls) {
    // 限制水平旋转 (Azimuth) - 左右各 45 度
    viewer.controls.minAzimuthAngle = -Math.PI / 8;
    viewer.controls.maxAzimuthAngle = Math.PI / 8;

    // 限制垂直旋转 (Polar) - 限制在水平线上下 30 度
    // 0 是顶视图, PI 是底视图, PI/2 是水平视图
    viewer.controls.minPolarAngle = Math.PI / 3;     // 60度
    viewer.controls.maxPolarAngle = 2 * Math.PI / 3; // 120度

    // 限制缩放距离
    // viewer.controls.minDistance = 10;
    // viewer.controls.maxDistance = 20;

    // 开启屏幕空间平移，更适合图片浏览体验
    viewer.controls.screenSpacePanning = true;

    // 禁用默认的旋转控制（改为鼠标跟随）
    viewer.controls.enableRotate = false;
    
    // 更新控制器状态
    viewer.controls.update();
}

// 鼠标跟随状态
let mouseX = 0;
let mouseY = 0;

// 监听鼠标移动
container.addEventListener('mousemove', (e) => {
    const rect = container.getBoundingClientRect();
    // 归一化到 -1 到 1
    mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouseY = ((e.clientY - rect.top) / rect.height) * 2 - 1;
});

// 监听文件选择
fileInput.addEventListener('change', loadFile);
// 监听重置按钮
resetBtn.addEventListener('click', resetView);

// 监听 Z 轴滑块
zAxisSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    zAxisValue.textContent = val;
    
    if (viewer.controls) {
        // 只更新 Z 轴，保持 X, Y 不变
        viewer.controls.target.z = val;
        // 如果需要实时看到效果，通常需要 update，但这取决于 control 类型
        viewer.controls.update();
    }
});

// 陀螺仪控制逻辑
const gyroBtn = document.getElementById('gyroBtn');
let gyroEnabled = false;
let initialReferenceSet = false;
let initialBeta = 0;
let initialGamma = 0;
let baseAzimuth = 0;
let basePolar = 0;
let currentBeta = null;
let currentGamma = null;

gyroBtn.addEventListener('click', async () => {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        // iOS 13+ 需要请求权限
        try {
            const response = await DeviceOrientationEvent.requestPermission();
            if (response === 'granted') {
                toggleGyro();
            } else {
                alert('需要陀螺仪权限才能使用此功能');
            }
        } catch (e) {
            console.error(e);
            alert('请求陀螺仪权限失败');
        }
    } else {
        // Android 或旧版 iOS
        toggleGyro();
    }
});

function toggleGyro() {
    gyroEnabled = !gyroEnabled;
    gyroBtn.textContent = gyroEnabled ? "关闭陀螺仪控制" : "开启陀螺仪控制";
    
    if (gyroEnabled) {
        window.addEventListener('deviceorientation', onDeviceOrientation);
        initialReferenceSet = false;
    } else {
        window.removeEventListener('deviceorientation', onDeviceOrientation);
    }
}

function onDeviceOrientation(event) {
    currentBeta = event.beta;
    currentGamma = event.gamma;
}

// 统一的相机控制循环（处理鼠标跟随和陀螺仪）
function updateCameraControl() {
    requestAnimationFrame(updateCameraControl);
    
    if (!viewer || !viewer.controls) return;

    // 获取当前限制
    const minAz = viewer.controls.minAzimuthAngle;
    const maxAz = viewer.controls.maxAzimuthAngle;
    const minPol = viewer.controls.minPolarAngle;
    const maxPol = viewer.controls.maxPolarAngle;

    let targetAzimuth, targetPolar;

    if (gyroEnabled) {
        // --- 陀螺仪模式 ---
        if (!initialReferenceSet) {
            if (currentBeta !== null && currentGamma !== null) {
                initialBeta = currentBeta;
                initialGamma = currentGamma;
                baseAzimuth = viewer.controls.getAzimuthalAngle();
                basePolar = viewer.controls.getPolarAngle();
                initialReferenceSet = true;
            }
            return;
        }

        const sensitivity = 2.0;
        const deltaGamma = (currentGamma - initialGamma) * sensitivity;
        const deltaBeta = (currentBeta - initialBeta) * sensitivity;

        targetAzimuth = baseAzimuth + THREE.MathUtils.degToRad(deltaGamma);
        targetPolar = basePolar + THREE.MathUtils.degToRad(deltaBeta);

    } else {
        // --- 鼠标跟随模式 ---
        // 将 normalized mouseX (-1 to 1) 映射到 Azimuth 范围
        // 将 normalized mouseY (-1 to 1) 映射到 Polar 范围
        
        targetAzimuth = THREE.MathUtils.lerp(minAz, maxAz, (mouseX + 1) / 2);
        targetPolar = THREE.MathUtils.lerp(minPol, maxPol, (mouseY + 1) / 2);
    }

    // 应用限制
    targetAzimuth = Math.max(minAz, Math.min(maxAz, targetAzimuth));
    targetPolar = Math.max(minPol, Math.min(maxPol, targetPolar));

    // 平滑插值 (Lerp)
    const currentAzimuth = viewer.controls.getAzimuthalAngle();
    const currentPolar = viewer.controls.getPolarAngle();
    const radius = viewer.controls.getDistance();

    const lerpFactor = 0.1;
    const newAzimuth = THREE.MathUtils.lerp(currentAzimuth, targetAzimuth, lerpFactor);
    const newPolar = THREE.MathUtils.lerp(currentPolar, targetPolar, lerpFactor);

    // 更新位置
    const position = new THREE.Vector3();
    position.setFromSphericalCoords(radius, newPolar, newAzimuth);
    
    if (viewer.controls.target) {
        position.add(viewer.controls.target);
    }

    viewer.camera.position.copy(position);
    viewer.camera.lookAt(viewer.controls.target);
}

// 启动控制循环
requestAnimationFrame(updateCameraControl);

async function loadFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    loadingDiv.style.display = 'block';

    try {
        // 尝试清除旧场景
        // 注意：不同版本的库可能有不同的API来移除场景，这里尝试通用的方法
        // 如果 removeSplatScene 只有在特定版本有效，可能需要调整
        if (typeof viewer.getSplatSceneCount === 'function' && typeof viewer.removeSplatScene === 'function') {
            const count = viewer.getSplatSceneCount();
            for (let i = 0; i < count; i++) {
                // 总是移除索引0，因为移除后索引会变化
                viewer.removeSplatScene(0);
            }
        }

        const fileURL = URL.createObjectURL(file);

        // 根据文件名判断格式
        let format;
        const fileName = file.name.toLowerCase();
        if (fileName.endsWith('.ply')) {
            format = SceneFormat.Ply;
        } else if (fileName.endsWith('.splat')) {
            format = SceneFormat.Splat;
        } else if (fileName.endsWith('.ksplat')) {
            format = SceneFormat.KSplat;
        }

        // 坐标系转换
        // OpenCV (x右, y下, z前) -> Three.js (x右, y上, z后)
        // 绕 X 轴旋转 180度
        const rotationQuaternion = [1, 0, 0, 0];

        await viewer.addSplatScene(fileURL, {
            'streamView': false, // 本地文件通常是一次性加载
            'rotation': rotationQuaternion,
            'scale': [1, 1, 1],
            'position': [0, 0, 0],
            'format': format // 显式指定格式，因为 Blob URL 没有扩展名
        });

        // 计算模型包围盒并居中
        if (viewer.splatMesh) {
            // true 表示应用场景变换 (包括我们的旋转)
            viewer.splatMesh.computeBoundingBox(true);
            const box = viewer.splatMesh.boundingBox;
            
            // Gaussian Splat 模型通常会有离群噪点，导致包围盒中心偏离视觉主体。
            // 因此我们默认使用原点 (0,0,0) 作为旋转中心，这通常是模型的主体位置。
            const modelTarget = new THREE.Vector3(0, 0, 0);
            
            // 重置 Z 轴滑块
            zAxisSlider.value = 0;
            zAxisValue.textContent = "0";
            
            // 更新控制器目标为原点
            if (viewer.controls) {
                viewer.controls.target.copy(modelTarget);
            }

            // 调整相机位置，使其位于模型前方
            // 距离稍微远一点以包含整个模型
            const distance = 1;
            
            // 设置相机位置 (在 Z 轴前方)
            const cameraPos = modelTarget.clone();
            cameraPos.z += distance; 
            
            viewer.camera.position.copy(cameraPos);
            viewer.camera.lookAt(modelTarget);
            
            if (viewer.controls) {
                viewer.controls.update();
            }
        }

        console.log('Scene loaded successfully');

    } catch (err) {
        console.error('Load error:', err);
        alert('加载文件失败: ' + err.message);
    } finally {
        loadingDiv.style.display = 'none';
        fileInput.value = ''; // 重置input以便再次选择同一文件
    }
}

function resetView() {
    if (viewer.camera) {
        // 重置相机位置
        viewer.camera.position.set(0, 0, 1);
        viewer.camera.lookAt(0, 0, 0);
        
        // 重置滑块
        zAxisSlider.value = 0;
        zAxisValue.textContent = "0";

        // 如果使用的是 OrbitControls，也需要更新 target
        if (viewer.controls) {
            viewer.controls.target.set(0, 0, 0);
            viewer.controls.update();
        }
    }
}
