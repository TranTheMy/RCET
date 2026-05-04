import React, { useState } from 'react';
import { Download, CheckSquare, Clock, XCircle, CheckCircle, FileText, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { commitmentService } from '../../../services/commitment.service';
import { useAuthStore } from '../../../store/authStore';

interface CommitmentTabProps {
  projectId: string;
  projectName: string; // <-- Thêm prop này để lấy tên dự án
  commitments: any[]; 
  onReload: () => void;
}

const CommitmentTab: React.FC<CommitmentTabProps> = ({ projectId, projectName, commitments, onReload }) => {
  const { user } = useAuthStore();
  const isVienTruong = user?.system_role === 'vien_truong' || user?.system_role === 'truong_lab';
  
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  const approvedCommitments = commitments.filter(c => c.status === 'b_approved');
  
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(approvedCommitments.map(c => c.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // NÚT 1: Viện trưởng tải Hợp đồng (Đã sửa logic đặt tên file ZIP)
  const handleExportFiles = async () => {
    try {
      setIsExporting(true);
      // Gửi kèm danh sách ID đã chọn nếu Backend của bạn hỗ trợ lọc theo ID, 
      // nếu không thì mặc định tải hết các bản 'b_approved' của projectId
      const res = await commitmentService.exportZip(projectId, selectedIds); 
      
      const blob = new Blob([res], { type: 'application/zip' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      // ĐẶT TÊN FILE ZIP THEO YÊU CẦU: Ban_Cam_Ket_NCKH + Tên Project
      const cleanProjectName = projectName.replace(/\s+/g, '_'); // Xóa khoảng trắng để tránh lỗi file
      link.download = `Ban_Cam_Ket_NCKH_${cleanProjectName}.zip`;

      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('Đã xuất tập tin nén thành công!');
    } catch (error) {
      toast.error('Lỗi tải file. Vui lòng thử lại.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleArchive = async () => {
    if (selectedIds.length === 0) return;
    try {
      setIsArchiving(true);
      await commitmentService.archiveHardcopies({ commitmentIds: selectedIds });
      toast.success('Đã lưu trữ bản cứng thành công!');
      setSelectedIds([]);
      onReload();
    } catch (error) {
      toast.error('Lỗi khi lưu trữ bản cứng.');
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <FileText size={20} className="text-cyan-600" /> COMMITMENTS MANAGEMENT
          </h3>
          <p className="text-xs text-slate-500 mt-1">Dự án: <span className="font-bold text-slate-700">{projectName}</span></p>
        </div>

        {isVienTruong && (
          <div className="flex gap-3">
            <button
              onClick={handleExportFiles}
              disabled={approvedCommitments.length === 0 || isExporting}
              className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-cyan-600 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              Export ZIP ({selectedIds.length || approvedCommitments.length})
            </button>
            <button
              onClick={handleArchive}
              disabled={selectedIds.length === 0 || isArchiving}
              className="px-4 py-2 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-emerald-100 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {isArchiving ? <Loader2 size={16} className="animate-spin" /> : <CheckSquare size={16} />}
              Confirm hardcopy ({selectedIds.length})
            </button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-2xl">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
            <tr>
              {isVienTruong && (
                <th className="px-4 py-3 text-center w-12">
                  <input 
                    type="checkbox" 
                    className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                    onChange={handleSelectAll}
                    checked={selectedIds.length === approvedCommitments.length && approvedCommitments.length > 0}
                  />
                </th>
              )}
              <th className="px-4 py-3 font-bold uppercase text-[10px] tracking-widest">MEMBER</th>
              <th className="px-4 py-3 font-bold uppercase text-[10px] tracking-widest text-center">STATUS</th>
              <th className="px-4 py-3 font-bold uppercase text-[10px] tracking-widest">NOTES / REASON</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {commitments.length === 0 ? (
              <tr><td colSpan={4} className="text-center py-8 text-slate-400">Chưa có dữ liệu cam kết.</td></tr>
            ) : (
              commitments.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/50">
                  {isVienTruong && (
                    <td className="px-4 py-3 text-center">
                      <input 
                        type="checkbox"
                        className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 disabled:opacity-30"
                        checked={selectedIds.includes(c.id)}
                        onChange={() => handleSelectOne(c.id)}
                        disabled={c.status !== 'b_approved'} 
                      />
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <p className="font-bold text-slate-900">{c.user?.full_name}</p>
                    <p className="text-[10px] text-slate-500 font-mono">{c.user?.email}</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {c.status === 'pending_b_approval' && <span className="inline-flex items-center gap-1 text-amber-500 text-xs font-bold bg-amber-50 px-2 py-1 rounded"><Clock size={12}/> Chờ xác nhận</span>}
                    {c.status === 'b_approved' && <span className="inline-flex items-center gap-1 text-blue-500 text-xs font-bold bg-blue-50 px-2 py-1 rounded"><CheckCircle size={12}/> Đã đồng ý (Chờ in)</span>}
                    {c.status === 'b_rejected' && <span className="inline-flex items-center gap-1 text-red-500 text-xs font-bold bg-red-50 px-2 py-1 rounded"><XCircle size={12}/> Đã từ chối</span>}
                    {c.status === 'active' && <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-bold bg-emerald-50 px-2 py-1 rounded"><CheckSquare size={12}/> Đã lưu hồ sơ</span>}
                  </td>
                  <td className="px-4 py-3">
                    {c.reject_reason ? (
                      <p className="text-xs text-red-600 bg-red-50 p-2 rounded truncate max-w-xs" title={c.reject_reason}>
                        Lý do: {c.reject_reason}
                      </p>
                    ) : (
                      <span className="text-slate-300">-</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CommitmentTab;