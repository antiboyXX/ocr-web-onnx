import os
import sys
import json
import base64
import shutil
import zipfile
from io import BytesIO
from datetime import datetime
from flask import Flask, request, jsonify, send_file, send_from_directory
from flask_cors import CORS
import cv2
import numpy as np
import easyocr
# 修复Matplotlib后端问题 - 必须在导入pyplot之前设置
import matplotlib
matplotlib.use('Agg')  # 使用非GUI后端，解决多线程问题
import matplotlib.pyplot as plt
import matplotlib.font_manager as fm

# 修复PIL版本兼容性问题
try:
    from PIL import Image
    # 检查是否有ANTIALIAS属性，如果没有则添加兼容性支持
    if not hasattr(Image, 'ANTIALIAS'):
        Image.ANTIALIAS = Image.LANCZOS
        print("🔧 已修复PIL.Image.ANTIALIAS兼容性问题")
except ImportError:
    print("⚠️ PIL/Pillow未安装")
except Exception as e:
    print(f"⚠️ PIL兼容性处理出错: {e}")

# 添加项目根目录到Python路径
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
sys.path.append(parent_dir)

app = Flask(__name__)
CORS(app)

# 配置
UPLOAD_FOLDER = 'uploads'
RESULTS_FOLDER = 'results'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(RESULTS_FOLDER, exist_ok=True)

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

class WebOCRProcessor:
    def __init__(self):
        """初始化Web OCR处理器"""
        setup_chinese_font()
        print("🔍 初始化中文OCR...")
        self.reader = easyocr.Reader(['ch_sim', 'en'], gpu=False)
        print("✅ OCR初始化完成")
    
    def create_output_directory(self, base_name):
        """创建输出目录"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        # 确保在当前目录（OCR_Web_ONNX）下创建results文件夹
        output_dir = os.path.join('.', RESULTS_FOLDER, f"{base_name}_{timestamp}")
        os.makedirs(output_dir, exist_ok=True)
        print(f"🗂️ 创建输出目录: {os.path.abspath(output_dir)}")
        return output_dir
    
    def detect_and_recognize_text(self, image_path):
        """检测并识别文字"""
        print(f"📷 处理图像: {image_path}")
        
        # 检测和识别文字
        results = self.reader.readtext(image_path, 
                                     width_ths=0.5,
                                     height_ths=0.5,
                                     paragraph=False)
        
        # 处理结果
        print(f"🎯 检测到 {len(results)} 个文字区域")
        valid_results = []
        for i, (bbox, text, confidence) in enumerate(results):
            if confidence > 0.3:
                print(f"  {i+1}. '{text}' (置信度: {confidence:.2f})")
                valid_results.append({
                    'bbox': bbox,
                    'text': text,
                    'confidence': confidence,
                    'id': i+1
                })
        
        return valid_results
    
    def create_text_masks(self, img, valid_results):
        """创建文字区域掩码"""
        print("🎭 创建文字掩码...")
        
        height, width = img.shape[:2]
        
        # 创建总体掩码
        combined_mask = np.zeros((height, width), dtype=np.uint8)
        
        # 为每个文字区域创建单独的掩码
        individual_masks = []
        
        for result in valid_results:
            bbox = result['bbox']
            text = result['text']
            result_id = result['id']
            
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
            
            individual_masks.append({
                'mask': single_mask,
                'text': text,
                'id': result_id,
                'bbox': bbox
            })
        
        # 对掩码进行形态学处理
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        combined_mask = cv2.morphologyEx(combined_mask, cv2.MORPH_CLOSE, kernel)
        combined_mask = cv2.dilate(combined_mask, kernel, iterations=1)
        
        return combined_mask, individual_masks
    
    def separate_text_regions(self, img, individual_masks):
        """分离每个文字区域"""
        print("✂️ 分离文字区域...")
        
        text_regions = []
        
        for mask_info in individual_masks:
            mask = mask_info['mask']
            text = mask_info['text']
            result_id = mask_info['id']
            
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
                text_regions.append({
                    'image': cropped_text,
                    'text': text,
                    'id': result_id,
                    'position': (x, y, w, h)
                })
        
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
    
    def create_visualization(self, img_rgb, valid_results):
        """创建可视化图像"""
        print("🎨 创建可视化图像...")
        
        try:
            # 创建matplotlib图形（线程安全）
            plt.ioff()  # 关闭交互模式
            fig, ax = plt.subplots(1, 1, figsize=(15, 10))
            ax.imshow(img_rgb)
            
            # 颜色列表
            colors = ['red', 'green', 'blue', 'orange', 'purple', 'brown', 'pink', 'cyan']
            
            # 绘制检测框和文字标注
            for result in valid_results:
                bbox = result['bbox']
                text = result['text']
                confidence = result['confidence']
                num = result['id']
                
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
            ax.set_title(f'中文OCR识别结果 - 检测到 {len(valid_results)} 个文字', fontsize=16, pad=20)
            ax.axis('off')
            
            # 保存到内存
            buffer = BytesIO()
            plt.savefig(buffer, format='png', dpi=300, bbox_inches='tight')
            buffer.seek(0)
            
            return buffer.getvalue()
            
        except Exception as e:
            print(f"❌ 创建可视化图像失败: {e}")
            # 返回空字节，调用者需要处理
            return b''
        finally:
            # 确保图形被关闭，防止内存泄漏
            plt.close('all')
    
    def save_results(self, output_dir, base_name, img, img_rgb, valid_results, 
                    combined_mask, text_regions, inpainted_results, visualization):
        """保存所有结果"""
        print(f"💾 保存结果到: {output_dir}")
        print(f"💾 当前工作目录: {os.getcwd()}")
        print(f"💾 输出目录绝对路径: {os.path.abspath(output_dir)}")
        
        file_paths = {}
        
        # 1. 保存可视化结果
        viz_path = os.path.join(output_dir, f"{base_name}_visualization.png")
        with open(viz_path, 'wb') as f:
            f.write(visualization)
        file_paths['visualization'] = viz_path
        
        # 2. 保存原图
        original_path = os.path.join(output_dir, f"{base_name}_original.jpg")
        cv2.imwrite(original_path, cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR))
        file_paths['original'] = original_path
        
        # 3. 保存文字掩码
        mask_path = os.path.join(output_dir, f"{base_name}_text_mask.jpg")
        cv2.imwrite(mask_path, combined_mask)
        file_paths['mask'] = mask_path
        
        # 4. 保存分离的文字区域
        text_folder = os.path.join(output_dir, "separated_texts")
        os.makedirs(text_folder, exist_ok=True)
        
        text_files = []
        for region in text_regions:
            safe_filename = f"{base_name}_text_{region['id']:02d}_pos_{region['position'][0]}_{region['position'][1]}.jpg"
            file_path = os.path.join(text_folder, safe_filename)
            cv2.imwrite(file_path, region['image'])
            text_files.append({
                'path': file_path,
                'filename': safe_filename,
                'text': region['text'],
                'id': region['id']
            })
        
        file_paths['text_regions'] = text_files
        
        # 5. 保存修复后的图像
        repaired_folder = os.path.join(output_dir, "repaired_images")
        os.makedirs(repaired_folder, exist_ok=True)
        
        repaired_files = {}
        for method, result in inpainted_results.items():
            repaired_path = os.path.join(repaired_folder, f"{base_name}_repaired_{method}.jpg")
            cv2.imwrite(repaired_path, result)
            repaired_files[method] = repaired_path
        
        file_paths['repaired'] = repaired_files
        
        # 6. 保存文字信息
        info_path = os.path.join(output_dir, f"{base_name}_text_info.txt")
        print(f"📝 保存文字信息到: {info_path}")
        
        try:
            with open(info_path, 'w', encoding='utf-8') as f:
                f.write("图像文字识别结果\n")
                f.write("=" * 40 + "\n")
                f.write(f"处理时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
                f.write(f"检测到的文字数量: {len(valid_results)}\n\n")
                
                f.write("文字识别详情:\n")
                f.write("-" * 30 + "\n")
                for result in valid_results:
                    f.write(f"{result['id']:2d}. {result['text']} (置信度: {result['confidence']:.2f})\n")
                
                f.write(f"\n文件映射:\n")
                f.write("-" * 30 + "\n")
                for text_file in text_files:
                    f.write(f"ID {text_file['id']}: {text_file['filename']} -> '{text_file['text']}'\n")
            
            print(f"✅ 文字信息文件已保存: {os.path.abspath(info_path)}")
            print(f"📝 文件大小: {os.path.getsize(info_path)} 字节")
            
        except Exception as e:
            print(f"❌ 保存文字信息失败: {e}")
        
        file_paths['info'] = info_path
        
        # 7. 创建概览图
        summary_path = self.create_summary_image(output_dir, base_name, img_rgb, 
                                                combined_mask, inpainted_results['mixed'], 
                                                len(valid_results))
        file_paths['summary'] = summary_path
        
        return file_paths
    
    def create_summary_image(self, output_dir, base_name, original, mask, repaired, text_count):
        """创建结果概览图"""
        try:
            plt.ioff()  # 关闭交互模式
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
            summary_path = os.path.join(output_dir, f"{base_name}_summary.png")
            plt.savefig(summary_path, dpi=300, bbox_inches='tight')
            
            return summary_path
            
        except Exception as e:
            print(f"❌ 创建概览图失败: {e}")
            # 创建一个简单的替代图像
            summary_path = os.path.join(output_dir, f"{base_name}_summary.png")
            simple_img = np.ones((400, 600, 3), dtype=np.uint8) * 255
            cv2.putText(simple_img, "Summary creation failed", (50, 200), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 0), 2)
            cv2.imwrite(summary_path, simple_img)
            return summary_path
        finally:
            # 确保图形被关闭
            plt.close('all')
    
    def process_image(self, image_path):
        """完整的图像处理流程"""
        print("🚀 开始Web OCR处理流程")
        
        try:
            # 读取图像
            img = cv2.imread(image_path)
            img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            
            # 1. 检测和识别文字
            valid_results = self.detect_and_recognize_text(image_path)
            
            if not valid_results:
                return {
                    'success': False,
                    'message': '未检测到任何文字',
                    'text_count': 0
                }
            
            # 2. 创建文字掩码
            combined_mask, individual_masks = self.create_text_masks(img, valid_results)
            
            # 3. 分离文字区域
            text_regions = self.separate_text_regions(img, individual_masks)
            
            # 4. 修复图像
            inpainted_results = self.inpaint_image(img, combined_mask)
            
            # 5. 创建可视化
            visualization = self.create_visualization(img_rgb, valid_results)
            
            # 6. 保存结果
            base_name = os.path.splitext(os.path.basename(image_path))[0]
            output_dir = self.create_output_directory(base_name)
            file_paths = self.save_results(output_dir, base_name, img, img_rgb, 
                                         valid_results, combined_mask, text_regions, 
                                         inpainted_results, visualization)
            
            # 7. 准备响应数据
            response = {
                'success': True,
                'text_count': len(valid_results),
                'texts': [{'id': r['id'], 'text': r['text'], 'confidence': r['confidence']} 
                         for r in valid_results],
                'output_dir': output_dir,
                'files': file_paths
            }
            
            return response
            
        except Exception as e:
            print(f"❌ 处理错误: {e}")
            import traceback
            traceback.print_exc()
            return {
                'success': False,
                'message': f'处理失败: {str(e)}',
                'text_count': 0
            }

# 初始化OCR处理器
ocr_processor = WebOCRProcessor()

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/favicon.ico')
def favicon():
    # 返回一个简单的响应，避免404错误
    return '', 204

@app.route('/api/debug/files')
def debug_files():
    """调试：列出当前目录和results目录的文件"""
    try:
        debug_info = {
            'current_dir': os.getcwd(),
            'current_files': os.listdir('.'),
        }
        
        if os.path.exists(RESULTS_FOLDER):
            debug_info['results_dir'] = os.path.abspath(RESULTS_FOLDER)
            debug_info['results_files'] = []
            for root, dirs, files in os.walk(RESULTS_FOLDER):
                for file in files:
                    file_path = os.path.join(root, file)
                    debug_info['results_files'].append({
                        'path': file_path,
                        'size': os.path.getsize(file_path),
                        'exists': os.path.exists(file_path)
                    })
        
        return jsonify(debug_info)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/<path:filename>')
def serve_static(filename):
    return send_from_directory('.', filename)

@app.route('/api/upload', methods=['POST'])
def upload_image():
    """处理图片上传和OCR识别"""
    try:
        if 'image' not in request.files:
            return jsonify({'success': False, 'message': '没有上传文件'})
        
        file = request.files['image']
        if file.filename == '':
            return jsonify({'success': False, 'message': '文件名为空'})
        
        # 保存上传的图片
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{timestamp}_{file.filename}"
        file_path = os.path.join(UPLOAD_FOLDER, filename)
        file.save(file_path)
        
        # 处理图片
        result = ocr_processor.process_image(file_path)
        
        if result['success']:
            # 转换文件路径为相对路径，供前端访问（使用正斜杠）
            def fix_path(path):
                # 将Windows路径转换为URL路径
                rel_path = os.path.relpath(path, '.')
                return rel_path.replace('\\', '/')
            
            result['files']['visualization_url'] = f"/api/file/{fix_path(result['files']['visualization'])}"
            result['files']['original_url'] = f"/api/file/{fix_path(result['files']['original'])}"
            result['files']['mask_url'] = f"/api/file/{fix_path(result['files']['mask'])}"
            result['files']['summary_url'] = f"/api/file/{fix_path(result['files']['summary'])}"
            result['files']['info_url'] = f"/api/file/{fix_path(result['files']['info'])}"
            
            # 处理修复图像URL
            result['files']['repaired_urls'] = {}
            for method, path in result['files']['repaired'].items():
                result['files']['repaired_urls'][method] = f"/api/file/{fix_path(path)}"
            
            # 处理文字区域URL
            result['files']['text_region_urls'] = []
            for text_file in result['files']['text_regions']:
                result['files']['text_region_urls'].append({
                    'id': text_file['id'],
                    'text': text_file['text'],
                    'filename': text_file['filename'],
                    'url': f"/api/file/{fix_path(text_file['path'])}"
                })
        
        return jsonify(result)
        
    except Exception as e:
        print(f"❌ 上传处理错误: {e}")
        return jsonify({'success': False, 'message': f'处理失败: {str(e)}'})

@app.route('/api/file/<path:filename>')
def serve_file(filename):
    """提供文件下载服务"""
    try:
        # 将URL路径转换为系统路径
        file_path = filename.replace('/', os.sep)
        print(f"📁 请求文件: {filename}")
        print(f"📁 转换后路径: {file_path}")
        
        # 尝试多个可能的位置
        possible_paths = [
            file_path,                                    # 原始路径
            os.path.join('.', file_path),                # 当前目录
            os.path.abspath(file_path),                  # 绝对路径
            os.path.join(os.getcwd(), file_path),        # 工作目录
        ]
        
        for test_path in possible_paths:
            print(f"📁 测试路径: {test_path}")
            if os.path.exists(test_path):
                print(f"✅ 找到文件: {test_path}")
                return send_file(os.path.abspath(test_path))
        
        print(f"❌ 在所有可能位置都找不到文件: {filename}")
        print(f"📁 当前工作目录: {os.getcwd()}")
        print(f"📁 当前目录内容: {os.listdir('.')}")
        
        return jsonify({'error': f'文件不存在: {filename}'}), 404
        
    except Exception as e:
        print(f"❌ 文件服务错误: {e}")
        return jsonify({'error': str(e)}), 404

@app.route('/api/download/<path:output_dir>')
def download_results(output_dir):
    """打包下载所有结果"""
    try:
        print(f"📦 开始打包下载: {output_dir}")
        
        # 解析输出目录路径（处理URL编码的路径）
        output_dir = output_dir.replace('/', os.sep)
        
        # 尝试多个可能的路径
        possible_dirs = [
            output_dir,
            os.path.join('.', output_dir),
            os.path.join(RESULTS_FOLDER, os.path.basename(output_dir)),
            os.path.join('.', RESULTS_FOLDER, os.path.basename(output_dir))
        ]
        
        actual_dir = None
        for test_dir in possible_dirs:
            print(f"📦 测试目录: {test_dir}")
            if os.path.exists(test_dir):
                actual_dir = test_dir
                print(f"✅ 找到输出目录: {actual_dir}")
                break
        
        if not actual_dir:
            print(f"❌ 找不到输出目录: {output_dir}")
            print(f"📦 当前工作目录: {os.getcwd()}")
            print(f"📦 当前目录内容: {os.listdir('.')}")
            if os.path.exists(RESULTS_FOLDER):
                print(f"📦 results目录内容: {os.listdir(RESULTS_FOLDER)}")
            return jsonify({'error': f'输出目录不存在: {output_dir}'}), 404
        
        # 创建ZIP文件
        zip_filename = f"{os.path.basename(actual_dir)}_results.zip"
        zip_path = os.path.join('.', zip_filename)
        
        print(f"📦 创建ZIP文件: {zip_path}")
        
        file_count = 0
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, dirs, files in os.walk(actual_dir):
                print(f"📦 处理目录: {root}")
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, actual_dir)
                    print(f"📦 添加文件: {file_path} -> {arcname}")
                    zipf.write(file_path, arcname)
                    file_count += 1
        
        print(f"📦 ZIP文件创建完成，包含 {file_count} 个文件")
        print(f"📦 ZIP文件大小: {os.path.getsize(zip_path)} 字节")
        
        return send_file(os.path.abspath(zip_path), as_attachment=True, download_name=zip_filename)
        
    except Exception as e:
        print(f"❌ 打包下载错误: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print("🚀 启动Web OCR服务器...")
    print("📱 访问地址: http://localhost:5000")
    print("🔍 支持功能: 图文分离、掩码创建、图像修复")
    
    # 支持云平台动态端口（用于Railway、Render等部署）
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=False if os.environ.get('PORT') else True, host='0.0.0.0', port=port) 