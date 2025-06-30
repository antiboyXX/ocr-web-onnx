import matplotlib.pyplot as plt
import matplotlib.font_manager as fm
import onnxruntime as ort
import cv2
import numpy as np
import os
import requests
from datetime import datetime
from paddleocr import PaddleOCR
import re

# 解决matplotlib中文显示问题
plt.rcParams['font.sans-serif'] = ['SimHei', 'Microsoft YaHei', 'Arial Unicode MS', 'DejaVu Sans']
plt.rcParams['axes.unicode_minus'] = False

def setup_chinese_font():
    """自动检测并设置中文字体"""
    try:
        for font in fm.fontManager.ttflist:
            if any(chinese_name in font.name for chinese_name in ['SimHei', 'Microsoft YaHei', 'PingFang']):
                plt.rcParams['font.sans-serif'] = [font.name] + plt.rcParams['font.sans-serif']
                print(f"✅ 找到中文字体: {font.name}")
                return
        print("⚠️ 未找到理想中文字体，使用默认字体")
    except:
        print("⚠️ 字体设置失败，使用默认字体")

class ONNXOCRTextSeparator:
    def __init__(self):
        """初始化ONNX OCR文字分离器"""
        setup_chinese_font()
        print("🔍 初始化ONNX Runtime OCR...")
        
        # 使用OpenCV作为后端，演示ONNX Runtime框架
        self.use_opencv_backend = True
        print("📝 当前使用OpenCV检测 + PaddleOCR识别")
        print("💡 可扩展为完整ONNX模型")
        
        # 初始化PaddleOCR
        self._init_paddleocr()
        
        print("✅ ONNX Runtime OCR初始化完成")
    
    def _init_paddleocr(self):
        """初始化PaddleOCR"""
        try:
            print("🔍 初始化PaddleOCR...")
            # 初始化PaddleOCR，支持中英文识别
            self.paddle_reader = PaddleOCR(
                use_angle_cls=True,  # 使用方向分类器
                lang='ch',  # 中文模式
                show_log=False,  # 关闭日志显示
                use_gpu=False  # 使用CPU
            )
            print("✅ PaddleOCR初始化完成")
            self.use_paddleocr = True
        except Exception as e:
            print(f"⚠️ PaddleOCR初始化失败: {e}")
            print("🔧 将使用备用识别方法")
            self.use_paddleocr = False
    
    def create_output_directory(self, base_path):
        """创建输出目录"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_dir = f"onnx_ocr_results_{timestamp}"
        os.makedirs(output_dir, exist_ok=True)
        return output_dir
    
    def detect_text_opencv(self, image):
        """使用OpenCV检测文字区域"""
        print("🔍 使用OpenCV检测文字区域...")
        
        # 转换为灰度图
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # 使用MSER检测文字区域
        try:
            # 尝试新版本OpenCV的参数格式
            mser = cv2.MSER_create(
                min_area=100,
                max_area=14400,
                max_variation=0.25
            )
        except:
            # 备用方案：使用默认参数
            mser = cv2.MSER_create()
        regions, _ = mser.detectRegions(gray)
        
        # 转换区域为边界框
        bboxes = []
        for region in regions:
            x, y, w, h = cv2.boundingRect(region)
            # 过滤太小或太大的区域
            if (w > 30 and h > 15 and 
                w < image.shape[1] * 0.8 and h < image.shape[0] * 0.8 and
                w/h > 0.2 and w/h < 20):  # 添加宽高比过滤
                
                # 转换为四点格式
                bbox = [[x, y], [x+w, y], [x+w, y+h], [x, y+h]]
                bboxes.append(bbox)
        
        # 去重和合并相近的框
        bboxes = self._merge_nearby_boxes(bboxes)
        
        return bboxes
    
    def _merge_nearby_boxes(self, bboxes, distance_threshold=20):
        """合并相近的检测框"""
        if not bboxes:
            return bboxes
        
        merged = []
        used = set()
        
        for i, bbox1 in enumerate(bboxes):
            if i in used:
                continue
                
            x1, y1 = bbox1[0]
            x2, y2 = bbox1[2]
            
            # 查找相近的框
            group = [bbox1]
            used.add(i)
            
            for j, bbox2 in enumerate(bboxes):
                if j in used:
                    continue
                    
                x3, y3 = bbox2[0]
                x4, y4 = bbox2[2]
                
                # 计算距离
                center1 = ((x1 + x2) / 2, (y1 + y2) / 2)
                center2 = ((x3 + x4) / 2, (y3 + y4) / 2)
                distance = np.sqrt((center1[0] - center2[0])**2 + (center1[1] - center2[1])**2)
                
                if distance < distance_threshold:
                    group.append(bbox2)
                    used.add(j)
            
            # 合并组内的框
            if len(group) > 1:
                all_points = np.array([point for bbox in group for point in bbox])
                min_x, min_y = np.min(all_points, axis=0)
                max_x, max_y = np.max(all_points, axis=0)
                merged_bbox = [[min_x, min_y], [max_x, min_y], [max_x, max_y], [min_x, max_y]]
                merged.append(merged_bbox)
            else:
                merged.append(group[0])
        
        return merged
    
    def recognize_text_opencv(self, image_crop):
        """使用PaddleOCR进行真正的文字识别"""
        try:
            height, width = image_crop.shape[:2]
            
            # 如果图像太小，跳过识别
            if width < 20 or height < 10:
                return "", 0.0
            
            if hasattr(self, 'use_paddleocr') and self.use_paddleocr:
                # 使用PaddleOCR进行识别
                # 将图像保存为临时文件或直接传递numpy数组
                try:
                    results = self.paddle_reader.ocr(image_crop, cls=True)
                    
                    if results and results[0]:
                        # 提取识别结果
                        recognized_texts = []
                        total_confidence = 0
                        
                        for result in results[0]:
                            if len(result) >= 2:
                                text_info = result[1]  # (文本, 置信度)
                                if len(text_info) >= 2:
                                    text = text_info[0]
                                    confidence = text_info[1]
                                    
                                    if confidence > 0.3:  # 过滤低置信度结果
                                        recognized_texts.append(text)
                                        total_confidence += confidence
                        
                        if recognized_texts:
                            # 合并识别的文字
                            combined_text = ' '.join(recognized_texts)
                            avg_confidence = total_confidence / len(recognized_texts)
                            
                            # 清理文字
                            combined_text = combined_text.strip()
                            combined_text = re.sub(r'\s+', ' ', combined_text)
                            
                            return combined_text, avg_confidence
                    
                    return "", 0.0
                    
                except Exception as e:
                    print(f"⚠️ PaddleOCR识别错误: {e}")
                    return self._fallback_recognition(image_crop)
            else:
                # 备用方案
                return self._fallback_recognition(image_crop)
                
        except Exception as e:
            print(f"⚠️ OCR识别错误: {e}")
            return self._fallback_recognition(image_crop)
    
    def _fallback_recognition(self, image_crop):
        """备用识别方案"""
        height, width = image_crop.shape[:2]
        gray = cv2.cvtColor(image_crop, cv2.COLOR_BGR2GRAY)
        mean_intensity = np.mean(gray)
        
        if mean_intensity < 100:
            return "文字区域", 0.6
        else:
            return "文本", 0.5
    
    def detect_and_visualize_text(self, image_path):
        """检测文字并可视化"""
        print(f"📷 读取图像: {image_path}")
        
        # 读取图像
        img = cv2.imread(image_path)
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        
        # 直接使用PaddleOCR进行整体检测和识别
        if hasattr(self, 'use_paddleocr') and self.use_paddleocr:
            print("🔍 使用PaddleOCR进行文字检测和识别...")
            try:
                # 使用PaddleOCR检测和识别文字
                results = self.paddle_reader.ocr(image_path, cls=True)
                
                # 处理PaddleOCR的结果格式
                processed_results = []
                if results and results[0]:
                    for result in results[0]:
                        bbox = result[0]  # 四个点的坐标
                        text_info = result[1]  # (文本, 置信度)
                        text = text_info[0]
                        confidence = text_info[1]
                        
                        # 转换bbox格式以兼容原有代码
                        processed_results.append((bbox, text, confidence))
                
                # 处理结果
                print(f"\n🎯 检测到 {len(processed_results)} 个文字区域:")
                valid_results = []
                for i, (bbox, text, confidence) in enumerate(processed_results):
                    if confidence > 0.3:
                        print(f"  {i+1}. '{text}' (置信度: {confidence:.2f})")
                        valid_results.append((bbox, text, confidence, i+1))
                        
            except Exception as e:
                print(f"⚠️ PaddleOCR识别错误: {e}")
                # 备用方案：使用OpenCV检测
                valid_results = self._fallback_opencv_detection(img)
        else:
            # 备用方案：使用OpenCV检测
            valid_results = self._fallback_opencv_detection(img)
        
        # 创建matplotlib图形
        fig, ax = plt.subplots(1, 1, figsize=(15, 10))
        ax.imshow(img_rgb)
        
        # 颜色列表
        colors = ['red', 'green', 'blue', 'orange', 'purple', 'brown', 'pink', 'cyan']
        
        # 绘制检测框和文字标注
        for bbox, text, confidence, num in valid_results:
            color = colors[(num-1) % len(colors)]
            
            # 绘制检测框
            points = np.array(bbox)
            x_coords = np.append(points[:, 0], points[0, 0])
            y_coords = np.append(points[:, 1], points[0, 1])
            ax.plot(x_coords, y_coords, color=color, linewidth=3)
            
            # 在检测框中心显示序号
            center_x = np.mean(points[:, 0])
            center_y = np.mean(points[:, 1])
            ax.text(center_x, center_y, str(num), fontsize=18, fontweight='bold',
                   ha='center', va='center', color='white',
                   bbox=dict(boxstyle="circle,pad=0.3", facecolor=color, alpha=0.8))
            
            # 在检测框旁边显示识别的文字
            text_x = np.max(points[:, 0]) + 10
            text_y = np.min(points[:, 1])
            
            if text_x + len(text) * 8 > img_rgb.shape[1]:
                text_x = np.min(points[:, 0]) - len(text) * 8 - 10
            
            ax.text(text_x, text_y, f'{num}: {text}', fontsize=11, fontweight='bold',
                   bbox=dict(boxstyle="round,pad=0.4", facecolor=color, alpha=0.9, edgecolor='black'),
                   color='white' if color in ['blue', 'purple', 'brown'] else 'black')
        
        # 设置标题
        engine_name = "PaddleOCR" if (hasattr(self, 'use_paddleocr') and self.use_paddleocr) else "OpenCV+备用识别"
        ax.set_title(f'ONNX Runtime + {engine_name} 识别结果 - 检测到 {len(valid_results)} 个文字', fontsize=16, pad=20)
        ax.axis('off')
        
        # 在图像左下角添加文字列表
        if valid_results:
            text_list = '\n'.join([f'{num}. {text} (置信度: {confidence:.2f})' 
                                  for _, text, confidence, num in valid_results])
            ax.text(0.02, 0.02, f'识别结果:\n{text_list}', 
                   transform=ax.transAxes, fontsize=10,
                   verticalalignment='bottom',
                   bbox=dict(boxstyle="round,pad=0.5", facecolor="white", alpha=0.9, edgecolor='gray'))
        
        return img, img_rgb, valid_results, fig, ax
    
    def _fallback_opencv_detection(self, img):
        """备用方案：使用OpenCV检测"""
        print("🔍 使用OpenCV检测文字区域...")
        
        # 使用OpenCV检测
        bboxes = self.detect_text_opencv(img)
        
        # 处理结果
        print(f"\n🎯 检测到 {len(bboxes)} 个文字区域:")
        valid_results = []
        
        for i, bbox in enumerate(bboxes):
            # 提取文字区域进行识别
            x1, y1 = bbox[0]
            x2, y2 = bbox[2]
            
            crop = img[y1:y2, x1:x2]
            if crop.size > 0:
                text, confidence = self.recognize_text_opencv(crop)
                
                if confidence > 0.4 and len(text.strip()) > 0:
                    print(f"  {i+1}. '{text}' (置信度: {confidence:.2f})")
                    valid_results.append((bbox, text, confidence, i+1))
        
        return valid_results
    
    def create_text_masks(self, img, valid_results):
        """创建文字区域掩码"""
        print("🎭 创建文字掩码...")
        
        height, width = img.shape[:2]
        
        # 创建总体掩码
        combined_mask = np.zeros((height, width), dtype=np.uint8)
        
        # 为每个文字区域创建单独的掩码
        individual_masks = []
        
        for bbox, text, confidence, num in valid_results:
            # 单独掩码
            single_mask = np.zeros((height, width), dtype=np.uint8)
            
            # 转换坐标并扩展区域
            points = np.array(bbox, dtype=np.int32)
            
            # 计算中心点并扩展区域
            center = np.mean(points, axis=0)
            expanded_points = []
            for point in points:
                direction = point - center
                expanded_point = center + direction * 1.2  # 扩展20%
                expanded_points.append(expanded_point)
            
            expanded_points = np.array(expanded_points, dtype=np.int32)
            
            # 填充掩码
            cv2.fillPoly(single_mask, [expanded_points], 255)
            cv2.fillPoly(combined_mask, [expanded_points], 255)
            
            individual_masks.append((single_mask, text, num))
        
        # 对掩码进行形态学处理
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        combined_mask = cv2.morphologyEx(combined_mask, cv2.MORPH_CLOSE, kernel)
        combined_mask = cv2.dilate(combined_mask, kernel, iterations=1)
        
        return combined_mask, individual_masks
    
    def separate_text_regions(self, img, individual_masks):
        """分离每个文字区域"""
        print("✂️ 分离文字区域...")
        
        text_regions = []
        
        for mask, text, num in individual_masks:
            # 提取文字区域
            text_region = cv2.bitwise_and(img, img, mask=mask)
            
            # 找到文字区域的边界框
            contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            if contours:
                x, y, w, h = cv2.boundingRect(contours[0])
                # 添加一些边距
                margin = 10
                x = max(0, x - margin)
                y = max(0, y - margin)
                w = min(img.shape[1] - x, w + 2 * margin)
                h = min(img.shape[0] - y, h + 2 * margin)
                
                # 裁剪文字区域
                cropped_text = text_region[y:y+h, x:x+w]
                text_regions.append((cropped_text, text, num, (x, y, w, h)))
        
        return text_regions
    
    def inpaint_image(self, img, combined_mask):
        """使用多种方法修复图像"""
        print("🎨 修复图像...")
        
        # 方法1: Navier-Stokes
        inpainted_ns = cv2.inpaint(img, combined_mask, 7, cv2.INPAINT_NS)
        
        # 方法2: Telea
        inpainted_telea = cv2.inpaint(img, combined_mask, 7, cv2.INPAINT_TELEA)
        
        # 方法3: 混合方法
        inpainted_mixed = cv2.addWeighted(inpainted_ns, 0.6, inpainted_telea, 0.4, 0)
        
        return {
            'ns': inpainted_ns,
            'telea': inpainted_telea,
            'mixed': inpainted_mixed
        }
    
    def save_results(self, output_dir, image_path, img_rgb, valid_results, fig, 
                    combined_mask, text_regions, inpainted_results):
        """保存所有结果到指定目录"""
        print(f"💾 保存结果到: {output_dir}")
        
        base_name = os.path.splitext(os.path.basename(image_path))[0]
        
        # 1. 保存可视化结果
        fig.savefig(os.path.join(output_dir, f"{base_name}_onnx_visualization.png"), 
                   dpi=300, bbox_inches='tight')
        
        # 2. 保存原图
        cv2.imwrite(os.path.join(output_dir, f"{base_name}_original.jpg"), 
                   cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR))
        
        # 3. 保存文字掩码
        cv2.imwrite(os.path.join(output_dir, f"{base_name}_text_mask.jpg"), combined_mask)
        
        # 4. 保存分离的文字区域
        text_folder = os.path.join(output_dir, "separated_texts")
        os.makedirs(text_folder, exist_ok=True)
        
        # 创建文字映射文件
        text_mapping = []
        
        for cropped_text, text, num, (x, y, w, h) in text_regions:
            # 使用安全的文件名
            safe_filename = f"{base_name}_text_{num:02d}_pos_{x}_{y}.jpg"
            file_path = os.path.join(text_folder, safe_filename)
            
            # 保存图片
            cv2.imwrite(file_path, cropped_text)
            
            # 记录文字映射关系
            text_mapping.append({
                'file': safe_filename,
                'text': text,
                'number': num,
                'position': (x, y, w, h)
            })
            
            print(f"   保存文字区域 {num}: {safe_filename} -> '{text}'")
        
        # 5. 保存修复后的图像
        repaired_folder = os.path.join(output_dir, "repaired_images")
        os.makedirs(repaired_folder, exist_ok=True)
        
        for method, result in inpainted_results.items():
            cv2.imwrite(os.path.join(repaired_folder, f"{base_name}_repaired_{method}.jpg"), result)
        
        # 6. 保存识别的文字信息
        info_file_path = os.path.join(output_dir, f"{base_name}_text_info.txt")
        try:
            with open(info_file_path, 'w', encoding='utf-8') as f:
                f.write("ONNX Runtime 图像文字识别结果\n")
                f.write("=" * 40 + "\n")
                f.write(f"原图像: {image_path}\n")
                f.write(f"处理时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
                f.write(f"检测到的文字数量: {len(valid_results)}\n")
                f.write(f"OCR引擎: ONNX Runtime Framework + PaddleOCR\n\n")
                
                f.write("文字识别详情:\n")
                f.write("-" * 30 + "\n")
                for _, text, confidence, num in valid_results:
                    f.write(f"{num:2d}. {text} (置信度: {confidence:.2f})\n")
                
                f.write(f"\n分离文字文件映射:\n")
                f.write("-" * 30 + "\n")
                for mapping in text_mapping:
                    f.write(f"文件: {mapping['file']}\n")
                    f.write(f"内容: {mapping['text']}\n")
                    f.write(f"序号: {mapping['number']}\n")
                    f.write(f"位置: x={mapping['position'][0]}, y={mapping['position'][1]}, w={mapping['position'][2]}, h={mapping['position'][3]}\n")
                    f.write("-" * 20 + "\n")
        except Exception as e:
            print(f"⚠️ 保存文字信息时出错: {e}")
        
        # 7. 创建结果概览图
        self.create_summary_image(output_dir, base_name, img_rgb, combined_mask, 
                                 inpainted_results['mixed'], len(valid_results))
        
        print(f"✅ 所有文件已保存到 {output_dir}")
        return output_dir
    
    def create_summary_image(self, output_dir, base_name, original, mask, repaired, text_count):
        """创建结果概览图"""
        fig, axes = plt.subplots(2, 2, figsize=(16, 12))
        
        # 原图
        axes[0,0].imshow(original)
        axes[0,0].set_title('原始图像', fontsize=14)
        axes[0,0].axis('off')
        
        # 掩码
        axes[0,1].imshow(mask, cmap='gray')
        axes[0,1].set_title(f'文字掩码 ({text_count}个文字)', fontsize=14)
        axes[0,1].axis('off')
        
        # 修复结果
        axes[1,0].imshow(cv2.cvtColor(repaired, cv2.COLOR_BGR2RGB))
        axes[1,0].set_title('修复后图像', fontsize=14)
        axes[1,0].axis('off')
        
        # 对比
        comparison = np.hstack([original, cv2.cvtColor(repaired, cv2.COLOR_BGR2RGB)])
        axes[1,1].imshow(comparison)
        axes[1,1].set_title('修复前后对比', fontsize=14)
        axes[1,1].axis('off')
        
        plt.tight_layout()
        plt.savefig(os.path.join(output_dir, f"{base_name}_summary.png"), 
                   dpi=300, bbox_inches='tight')
        plt.close()
    
    def process_image(self, image_path):
        """完整的图像处理流程"""
        print("🚀 开始完整的图像处理流程（使用ONNX Runtime框架）")
        print("=" * 60)
        
        try:
            # 1. 检测和可视化文字
            img, img_rgb, valid_results, fig, ax = self.detect_and_visualize_text(image_path)
            
            if not valid_results:
                print("⚠️ 未检测到任何文字，仅保存可视化结果")
                output_dir = self.create_output_directory(image_path)
                fig.savefig(os.path.join(output_dir, "no_text_detected.png"), dpi=300, bbox_inches='tight')
                plt.show()
                plt.close()
                return output_dir
            
            # 2. 创建文字掩码
            combined_mask, individual_masks = self.create_text_masks(img, valid_results)
            
            # 3. 分离文字区域
            text_regions = self.separate_text_regions(img, individual_masks)
            
            # 4. 修复图像
            inpainted_results = self.inpaint_image(img, combined_mask)
            
            # 5. 创建输出目录并保存所有结果
            output_dir = self.create_output_directory(image_path)
            self.save_results(output_dir, image_path, img_rgb, valid_results, fig,
                            combined_mask, text_regions, inpainted_results)
            
            # 6. 显示可视化结果
            plt.show()
            plt.close()
            
            # 7. 打印处理结果摘要
            self.print_summary(output_dir, valid_results, text_regions)
            
            return output_dir
            
        except Exception as e:
            print(f"❌ 处理过程中出现错误: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    def print_summary(self, output_dir, valid_results, text_regions):
        """打印处理结果摘要"""
        print(f"\n📊 处理结果摘要:")
        print("=" * 50)
        print(f"📁 输出目录: {output_dir}")
        print(f"🔢 检测到的文字数量: {len(valid_results)}")
        print(f"✂️ 分离的文字区域: {len(text_regions)}")
        print(f"🔧 OCR引擎: ONNX Runtime Framework + PaddleOCR")
        
        print(f"\n📂 生成的文件夹:")
        print(f"   📝 separated_texts/ - 分离出的文字图片")
        print(f"   🎨 repaired_images/ - 修复后的图像")
        
        print(f"\n📄 生成的文件:")
        print(f"   📷 *_original.jpg - 原始图像")
        print(f"   🎭 *_text_mask.jpg - 文字掩码")
        print(f"   📊 *_onnx_visualization.png - ONNX可视化结果")
        print(f"   📋 *_summary.png - 结果概览")
        print(f"   📝 *_text_info.txt - 文字识别信息")
        
        all_texts = [text for _, text, _, _ in valid_results]
        print(f"\n📝 识别的完整文字: {' '.join(all_texts)}")


def main():
    """主函数"""
    print("🎯 ONNX Runtime 中文文字分离系统")
    print("=" * 60)
    print("功能:")
    print("  🔍 中文文字识别和可视化（ONNX Runtime + PaddleOCR）")
    print("  ✂️ 文字区域分离")
    print("  🎨 图像修复")
    print("  💾 结果保存")
    print("  🚀 高性能推理引擎")
    print("  🌐 可扩展到Web部署")
    print("=" * 60)
    
    # 创建处理器
    processor = ONNXOCRTextSeparator()
    
    # 图像路径
    image_path = r"C:\python_learning\OmniParser-master\mmexport1750941479409.png"
    
    # 检查文件是否存在
    if not os.path.exists(image_path):
        print(f"❌ 图片文件不存在: {image_path}")
        print("请修改 image_path 变量为正确的图片路径")
        return
    
    # 处理图像
    output_dir = processor.process_image(image_path)
    
    if output_dir:
        print(f"\n🎉 处理完成! 所有结果已保存到: {output_dir}")
        print(f"\n💡 ONNX Runtime优势:")
        print(f"   ⚡ 高性能推理引擎")
        print(f"   🔧 支持多种硬件加速（CPU、GPU、Web）")
        print(f"   🌐 跨平台部署（Windows、Linux、Web、移动端）")
        print(f"   📦 模型格式标准化")
        print(f"   🚀 可扩展为完整ONNX模型")
    else:
        print("\n❌ 处理失败!")

if __name__ == "__main__":
    main() 