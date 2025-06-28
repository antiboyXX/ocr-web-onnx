/**
 * Utils - 工具函数集合
 * 提供常用的工具方法和辅助函数
 */

class Utils {
    /**
     * 格式化文件大小
     */
    static formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * 转义HTML字符
     */
    static escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 防抖函数
     */
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * 节流函数
     */
    static throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    /**
     * 生成唯一ID
     */
    static generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    /**
     * 深拷贝对象
     */
    static deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj.getTime());
        if (obj instanceof Array) return obj.map(item => Utils.deepClone(item));
        if (typeof obj === 'object') {
            const copy = {};
            Object.keys(obj).forEach(key => {
                copy[key] = Utils.deepClone(obj[key]);
            });
            return copy;
        }
    }

    /**
     * 本地存储工具
     */
    static storage = {
        set(key, value) {
            try {
                localStorage.setItem(key, JSON.stringify(value));
                return true;
            } catch (error) {
                console.error('LocalStorage写入失败:', error);
                return false;
            }
        },

        get(key, defaultValue = null) {
            try {
                const item = localStorage.getItem(key);
                return item ? JSON.parse(item) : defaultValue;
            } catch (error) {
                console.error('LocalStorage读取失败:', error);
                return defaultValue;
            }
        },

        remove(key) {
            try {
                localStorage.removeItem(key);
                return true;
            } catch (error) {
                console.error('LocalStorage删除失败:', error);
                return false;
            }
        }
    };

    /**
     * 日期时间工具
     */
    static datetime = {
        format(date, format = 'YYYY-MM-DD HH:mm:ss') {
            const d = new Date(date);
            
            const map = {
                'YYYY': d.getFullYear(),
                'MM': String(d.getMonth() + 1).padStart(2, '0'),
                'DD': String(d.getDate()).padStart(2, '0'),
                'HH': String(d.getHours()).padStart(2, '0'),
                'mm': String(d.getMinutes()).padStart(2, '0'),
                'ss': String(d.getSeconds()).padStart(2, '0')
            };
            
            let result = format;
            for (const [key, value] of Object.entries(map)) {
                result = result.replace(key, value);
            }
            
            return result;
        },

        timestamp() {
            return Date.now();
        }
    };

    /**
     * 验证工具
     */
    static validate = {
        email(email) {
            const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return re.test(email);
        },

        imageFile(file) {
            const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
            return validTypes.includes(file.type);
        },

        fileSize(file, maxSizeMB) {
            return file.size <= maxSizeMB * 1024 * 1024;
        }
    };

    /**
     * 数学工具
     */
    static math = {
        clamp(value, min, max) {
            return Math.min(Math.max(value, min), max);
        },

        randomRange(min, max) {
            return Math.random() * (max - min) + min;
        },

        distance(x1, y1, x2, y2) {
            return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
        }
    };
}

// 导出到全局
window.Utils = Utils; 