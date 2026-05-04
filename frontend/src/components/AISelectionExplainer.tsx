import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Modal, Spin, Button, Typography, Space, Card } from 'antd';
import { RobotOutlined, CloseOutlined, BookOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { aiService } from '../services/ai.service';
import { useAuthStore } from '../store/authStore';
import { translateApiMessage } from '../utils/apiErrorI18n';

const { Paragraph, Text, Title } = Typography;

const isEditableElement = (el: HTMLElement | null) => {
  if (!el) return false;
  if (el.matches('input, textarea')) return true;
  if (el.isContentEditable) return true;
  return false;
};

const findEditableHostFromNode = (node: Node | null): HTMLElement | null => {
  if (!node) return null;
  const el = (node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as HTMLElement)) || null;
  if (!el) return null;
  return el.closest('input, textarea, [contenteditable="true"]') as HTMLElement | null;
};

const findEditableHostFromElement = (el: Element | null): HTMLElement | null => {
  if (!el) return null;
  return el.closest('input, textarea, [contenteditable="true"]') as HTMLElement | null;
};

const AISelectionExplainer = () => {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuthStore();
  const [selectedText, setSelectedText] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [explanation, setExplanation] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setModalVisible(false);
      setSelectedText('');
      setExplanation('');
    }
  }, [isAuthenticated]);

  const askAI = useCallback(async (textToExplain: string) => {
    setLoading(true);
    setExplanation('');
    try {
      const res = await aiService.explainSelectedText(textToExplain);
      if (res.success && res.data?.explanation) {
        setExplanation(res.data.explanation);
      } else {
        setExplanation(res.message || 'Rất tiếc, không nhận được lời giải thích. Vui lòng thử lại.');
      }
    } catch (error) {
      const fallback =
        'Rất tiếc, hệ thống AI đang bận hoặc lỗi kết nối. Vui lòng thử lại sau.';
      let msg = fallback;
      if (axios.isAxiosError(error)) {
        const serverMsg = error.response?.data?.message;
        if (typeof serverMsg === 'string' && serverMsg.trim()) {
          msg = translateApiMessage(t, serverMsg.trim());
        } else if (!error.response && error.message) {
          msg = `Không kết nối được API (${error.message}). Kiểm tra backend đang chạy và VITE_API_URL.`;
        }
      }
      setExplanation(msg);
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const processSelection = (targetEl: EventTarget | null) => {
      // 1. Kiểm tra nếu click vào bên trong Modal thì không làm gì cả
      if ((targetEl as HTMLElement | null)?.closest?.('.ant-modal')) return;

      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;

      // Ưu tiên xác định từ chính selection để tránh bắt nhầm label/error text.
      const fromAnchor = findEditableHostFromNode(selection.anchorNode);
      const fromFocus = findEditableHostFromNode(selection.focusNode);
      const fromTarget = findEditableHostFromElement(targetEl as Element | null);
      const fromActive = findEditableHostFromElement(document.activeElement);
      const editableHost = fromAnchor || fromFocus || fromTarget || fromActive;
      if (isEditableElement(editableHost)) {
        // Chỉ dịch text hiển thị (title/label), không dịch nội dung trong input/textarea.
        return;
      }

      const text = selection.toString().trim();
      
      // 2. Chỉ cần có text bôi đen là có thể dịch
      if (text && text.length > 0) {
        // Lưu lại văn bản được chọn để hiển thị trong Modal
        setSelectedText(text);
        // Hiện Modal ngay lập tức (vị trí giữa màn hình là mặc định của Modal)
        setModalVisible(true);
        // Gọi AI ngay lập tức
        askAI(text);
      }
    };

    const handleMouseUp = (e: MouseEvent) => processSelection(e.target);
    const handleKeyUp = (e: KeyboardEvent) => {
      if (!e.shiftKey && !e.ctrlKey) return;
      processSelection(e.target);
    };

    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('keyup', handleKeyUp);
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [isAuthenticated, askAI]);

  const handleClose = () => {
    // Chỉ cho phép đóng nếu AI không đang loading
    if (!loading) {
      setModalVisible(false);
      window.getSelection()?.removeAllRanges(); // Xóa vùng bôi đen trên trang
    }
  };

  if (!isAuthenticated) return null;

  return (
    <>
      <Modal
        // --- 🌟 CẤU HÌNH ĐỂ NẰM GIỮA VÀ BLUR NỀN ---
        open={modalVisible}
        onCancel={handleClose}
        centered // Đưa Modal ra chính giữa màn hình (theo cả chiều dọc và ngang)
        footer={null} // Không hiện nút OK/Cancel mặc định phía dưới
        closable={false} // Ẩn nút X mặc định ở góc trên
        width={500} // Chiều rộng vừa phải cho lời giải thích
        
        // --- 🎨 CẤU HÌNH Hiệu ứng MỜ NỀN (Blur Background) ---
        styles={{
          mask: {
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
          },
          body: { padding: '24px 30px' },
        }}
      >
        <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
          
          {/* Header custom với Icon và nút đóng */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Title level={4} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
              <RobotOutlined style={{ color: '#1890ff', fontSize: '24px' }} />
              <span style={{fontWeight: 600}}>AI Trợ Lý Nghiên Cứu</span>
            </Title>
            <Button 
              type="text" 
              icon={<CloseOutlined />} 
              onClick={handleClose} 
              disabled={loading} // Không cho đóng khi đang load
              style={{ fontSize: '18px' }} 
            />
          </div>

          {/* Hiển thị thuật ngữ người dùng đã chọn */}
          <div style={{ background: '#f5f5f5', padding: '12px 16px', borderRadius: 8 }}>
            <Text type="secondary" style={{fontSize: '12px'}}>Văn bản bạn đã chọn:</Text>
            <Paragraph strong style={{ margin: '4px 0 0 0', color: '#555' }}>
              <BookOutlined style={{marginRight: 6}} /> "{selectedText}"
            </Paragraph>
          </div>

          {/* Phần nội dung giải thích (Loading hoặc Text) */}
          <Card 
            size="small" 
            variant="borderless" 
            style={{ 
              background: '#e6f7ff', 
              borderRadius: 8, 
              borderLeft: '4px solid #1890ff',
              minHeight: '120px',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            {loading ? (
              <Spin description="AI đang phân tích ngữ cảnh..." style={{ width: '100%', padding: '20px 0' }} />
            ) : explanation ? (
              <Paragraph style={{ fontSize: '14px', lineHeight: '1.7', margin: 0, color: '#333' }}>
                {explanation}
              </Paragraph>
            ) : null}
          </Card>
          
          {loading && (
             <Text type="secondary" style={{fontSize: '12px', textAlign: 'center', display: 'block'}}>
                Hành động bôi đen và đóng Modal tạm thời bị khóa cho đến khi AI trả lời xong.
             </Text>
          )}

        </Space>
      </Modal>
    </>
  );
};

export default AISelectionExplainer;