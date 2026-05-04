import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FileSignature, CheckCircle, XCircle, Clock, AlertCircle, Loader2, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { commitmentService } from '../../services/commitment.service';

const MyCommitments: React.FC = () => {
  const [commitments, setCommitments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  // State cho Modal Từ chối
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedCommitment, setSelectedCommitment] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Lấy danh sách cam kết
  const fetchCommitments = async () => {
    try {
      setLoading(true);
      const data = await commitmentService.getMyCommitments();
      setCommitments(data || []);
    } catch (error) {
      toast.error('Lỗi khi tải danh sách cam kết.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCommitments();
  }, []);

  // Xử lý Đồng ý
  const handleApprove = async (id: string) => {
    try {
      setProcessingId(id);
      await commitmentService.updateStatus(id, { status: 'b_approved' });
      toast.success('Đã ký xác nhận thành công!');
      fetchCommitments(); // Reload lại list
    } catch (error) {
      toast.error('Có lỗi xảy ra, vui lòng thử lại!');
    } finally {
      setProcessingId(null);
    }
  };

  // Mở modal từ chối
  const openRejectModal = (id: string) => {
    setSelectedCommitment(id);
    setRejectReason('');
    setRejectModalOpen(true);
  };

  // Xử lý Submit Từ chối
  const handleConfirmReject = async () => {
    if (!rejectReason.trim()) {
      toast.error('Vui lòng nhập lý do từ chối.');
      return;
    }
    try {
      setProcessingId(selectedCommitment);
      await commitmentService.updateStatus(selectedCommitment!, { 
        status: 'b_rejected', 
        reason: rejectReason 
      });
      toast.success('Đã từ chối cam kết.');
      setRejectModalOpen(false);
      fetchCommitments();
    } catch (error) {
      toast.error('Có lỗi xảy ra, vui lòng thử lại!');
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-cyan-600" size={40} />
      </div>
    );
  }

  // Tách list đang chờ duyệt lên đầu
  const pendingList = commitments.filter(c => c.status === 'pending_b_approval');
  const historyList = commitments.filter(c => c.status !== 'pending_b_approval');

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12 font-sans">
      <div className="max-w-5xl mx-auto space-y-10">
        
        {/* Header */}
        <div className="flex items-center gap-4 border-b border-slate-200 pb-6">
          <div className="w-14 h-14 rounded-2xl bg-cyan-600 flex items-center justify-center text-white shadow-lg shadow-cyan-200">
            <FileSignature size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Cam kết của tôi</h1>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mt-1">
              Hợp đồng & Phân bổ quỹ nghiên cứu
            </p>
          </div>
        </div>

        {/* Danh sách CẦN XỬ LÝ */}
        <section>
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-2">
            <AlertCircle size={16} className="text-amber-500" /> Cần bạn xác nhận ({pendingList.length})
          </h2>
          <p className="text-sm text-slate-600 mb-4 max-w-3xl">
            Bạn được mời tham gia dự án dưới đây. Bạn có thể <strong>đồng ý</strong> hoặc <strong>từ chối</strong> — không bắt buộc phải tham gia.
          </p>
          
          {pendingList.length === 0 ? (
            <div className="p-8 bg-white border border-slate-200 rounded-3xl text-center">
              <p className="text-slate-500 font-medium">Bạn không có yêu cầu cam kết nào đang chờ.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {pendingList.map((item) => (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  key={item.id} 
                  className="bg-white border border-cyan-100 rounded-[32px] p-6 shadow-xl shadow-cyan-100/20 relative overflow-hidden"
                >
                  <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-cyan-400 to-blue-500"></div>
                  
                  <div className="mb-6">
                    <span className="inline-block px-3 py-1 bg-amber-50 text-amber-600 text-[10px] font-black uppercase tracking-widest rounded-lg mb-3">
                      Đang chờ duyệt
                    </span>
                    <h3 className="text-lg font-black text-slate-900 mb-1">{item.Project?.name}</h3>
                    <p className="text-xs text-slate-500 font-mono">Mã DA: {item.Project?.code}</p>
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-4 mb-6 border border-slate-100 space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500 font-medium">Đại diện (Bên A):</span>
                      <span className="font-bold text-slate-900">{item.Project?.leader?.full_name || 'Viện trưởng'}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500 font-medium">Quỹ Thực thi của nhóm:</span>
                      <span className="font-black text-cyan-600 text-lg">{item.Project?.party_b_percent}%</span>
                    </div>
                    <p className="text-[10px] text-slate-400 italic text-right mt-1">
                      (Mô hình phân bổ: {item.Project?.model_type})
                    </p>
                  </div>

                  <Link
                    to={`/projects/${item.project_id}`}
                    className="inline-flex items-center gap-2 text-[11px] font-bold text-cyan-700 hover:text-cyan-900 mb-4"
                  >
                    <ExternalLink size={14} /> Xem trang dự án (tùy chọn)
                  </Link>

                  <div className="flex gap-3">
                    <button 
                      onClick={() => handleApprove(item.id)}
                      disabled={processingId === item.id}
                      className="flex-1 bg-slate-900 text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-cyan-600 transition-colors flex justify-center items-center gap-2"
                    >
                      {processingId === item.id ? <Loader2 size={16} className="animate-spin" /> : <><CheckCircle size={16} /> Đồng ý tham gia</>}
                    </button>
                    <button 
                      onClick={() => openRejectModal(item.id)}
                      disabled={processingId === item.id}
                      className="px-6 bg-red-50 text-red-600 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-100 transition-colors flex justify-center items-center"
                    >
                      Từ chối
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </section>

        {/* Danh sách LỊCH SỬ (Đã duyệt/Từ chối) */}
        {historyList.length > 0 && (
          <section className="pt-8">
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
              <Clock size={16} /> Lịch sử cam kết
            </h2>
            <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] text-slate-400">Dự án</th>
                    <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] text-slate-400">Tỷ lệ Nhóm</th>
                    <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] text-slate-400">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {historyList.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-800">{item.Project?.name}</td>
                      <td className="px-6 py-4 font-bold text-cyan-600">{item.Project?.party_b_percent}%</td>
                      <td className="px-6 py-4">
                        {item.status === 'b_approved' || item.status === 'active' ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-emerald-50 text-emerald-600 text-xs font-bold">
                            <CheckCircle size={14} /> Đã đồng ý
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-red-50 text-red-600 text-xs font-bold">
                            <XCircle size={14} /> Đã từ chối
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      {/* MODAL TỪ CHỐI */}
      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-black text-slate-900 mb-2">Lý do từ chối</h3>
            <p className="text-xs text-slate-500 mb-6">Vui lòng cho Leader biết lý do bạn không đồng ý với mức phân bổ này.</p>
            
            <textarea
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-red-400 focus:ring-4 focus:ring-red-500/10 transition-all mb-6"
              rows={4}
              placeholder="Nhập lý do của bạn..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            ></textarea>

            <div className="flex gap-3">
              <button 
                onClick={() => setRejectModalOpen(false)}
                className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-colors"
              >
                Hủy
              </button>
              <button 
                onClick={handleConfirmReject}
                disabled={processingId === selectedCommitment}
                className="flex-1 bg-red-600 text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-700 transition-colors flex justify-center items-center gap-2"
              >
                {processingId === selectedCommitment ? <Loader2 size={16} className="animate-spin" /> : 'Gửi từ chối'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default MyCommitments;