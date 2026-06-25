import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronRight, Plus, Users, Trash2, Mail, Phone,
  Building2, Briefcase, ListChecks, Pencil,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { partnersApi } from '../../api/partners';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Avatar } from '../../components/ui/Avatar';
import type { Partner, Personnel } from '../../types';

export function PartnerDetailPage() {
  const { partnerId } = useParams<{ partnerId: string }>();
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: '', position: '', email: '', phone: '' });
  const [editPersonnel, setEditPersonnel] = useState<Personnel | null>(null);
  const [editForm, setEditForm] = useState({ name: '', position: '', email: '', phone: '' });

  const { data: partner, isLoading } = useQuery({
    queryKey: ['partner', partnerId],
    queryFn: () => partnersApi.getOne(partnerId!),
    enabled: !!partnerId,
  });

  const addPersonnel = useMutation({
    mutationFn: (data: any) => partnersApi.addPersonnel(partnerId!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partner', partnerId] });
      setAddOpen(false);
      setForm({ name: '', position: '', email: '', phone: '' });
      toast.success('인력이 등록되었습니다.');
    },
    onError: () => toast.error('등록에 실패했습니다.'),
  });

  const updatePersonnel = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Personnel> }) =>
      partnersApi.updatePersonnel(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partner', partnerId] });
      setEditPersonnel(null);
      toast.success('인력 정보가 수정되었습니다.');
    },
    onError: () => toast.error('수정에 실패했습니다.'),
  });

  const deletePersonnel = useMutation({
    mutationFn: (id: string) => partnersApi.deletePersonnel(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partner', partnerId] });
      toast.success('인력이 삭제되었습니다.');
    },
  });

  if (isLoading) {
    return <div className="p-6"><div className="h-8 bg-gray-100 rounded w-48 animate-pulse" /></div>;
  }
  if (!partner) return null;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-5">
        <Link to="/partners" className="hover:text-gray-600">파트너사 관리</Link>
        <ChevronRight size={14} />
        <span className="text-gray-900 font-medium">{partner.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
            <Building2 size={22} className="text-gray-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-700">{partner.name}</h1>
            {partner.description && <p className="text-sm text-gray-500 mt-0.5">{partner.description}</p>}
            <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
              {partner.contactName && <span>담당: {partner.contactName}</span>}
              {partner.email && <span className="flex items-center gap-1"><Mail size={11} />{partner.email}</span>}
              {partner.phone && <span className="flex items-center gap-1"><Phone size={11} />{partner.phone}</span>}
            </div>
          </div>
        </div>
        <Button variant="primary" size="sm" onClick={() => setAddOpen(true)}>
          <Plus size={14} /> 인력 등록
        </Button>
      </div>

      {/* Personnel list */}
      <div className="bg-white/85 backdrop-blur-md rounded-xl border border-white/80 shadow-[0_4px_16px_rgba(0,0,0,0.08),0_1px_4px_rgba(0,0,0,0.04),0_0_0_1px_rgba(255,255,255,0.9)_inset] ring-1 ring-gray-900/5 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100">
          <Users size={15} className="text-gray-500" />
          <h2 className="font-semibold text-sm text-gray-700">인력 목록</h2>
          <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">{partner.personnel?.length ?? 0}명</span>
        </div>

        {!partner.personnel?.length ? (
          <div className="py-12 text-center">
            <Users size={36} className="text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">등록된 인력이 없습니다.</p>
            <button onClick={() => setAddOpen(true)} className="text-gray-600 text-sm font-medium mt-2 hover:underline cursor-pointer">
              첫 인력 등록하기
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {(partner.personnel as Personnel[]).map((person) => (
              <div key={person.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50/80 transition-colors group">
                <Avatar name={person.name} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm text-gray-900">{person.name}</p>
                    {person.position && (
                      <span className="flex items-center gap-1 text-[11px] text-gray-600 bg-primary-50 px-1.5 py-0.5 rounded-full">
                        <Briefcase size={10} /> {person.position}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                    {person.email && <span className="flex items-center gap-1"><Mail size={10} />{person.email}</span>}
                    {person.phone && <span className="flex items-center gap-1"><Phone size={10} />{person.phone}</span>}
                    {person._count && (
                      <span className="flex items-center gap-1"><ListChecks size={10} />업무 {person._count.tasks}건</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-0.5 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all">
                  <button
                    onClick={() => { setEditPersonnel(person); setEditForm({ name: person.name ?? '', position: person.position ?? '', email: person.email ?? '', phone: person.phone ?? '' }); }}
                    className="text-gray-400 hover:text-primary-600 p-1.5 cursor-pointer"
                    title="수정"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => { if (confirm(`"${person.name}" 인력을 삭제하시겠습니까?`)) deletePersonnel.mutate(person.id); }}
                    className="text-gray-400 hover:text-red-500 p-1.5 cursor-pointer"
                    title="삭제"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit personnel modal */}
      <Modal open={!!editPersonnel} onClose={() => setEditPersonnel(null)} title="인력 수정">
        <form
          onSubmit={(e) => { e.preventDefault(); if (editPersonnel && editForm.name.trim()) updatePersonnel.mutate({ id: editPersonnel.id, data: editForm }); }}
          className="p-6 space-y-4"
        >
          <div className="flex gap-4">
            <Input label="이름 *" placeholder="홍길동" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required className="flex-1" />
            <Input label="직무" placeholder="백엔드 개발자" value={editForm.position} onChange={(e) => setEditForm({ ...editForm, position: e.target.value })} className="flex-1" />
          </div>
          <Input label="이메일" type="email" placeholder="person@partner.com" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
          <Input label="연락처" placeholder="010-1234-5678" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setEditPersonnel(null)}>취소</Button>
            <Button type="submit" variant="primary" loading={updatePersonnel.isPending}>저장</Button>
          </div>
        </form>
      </Modal>

      {/* Add personnel modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="인력 등록">
        <form
          onSubmit={(e) => { e.preventDefault(); if (form.name.trim()) addPersonnel.mutate(form); }}
          className="p-6 space-y-4"
        >
          <div className="flex gap-4">
            <Input label="이름 *" placeholder="홍길동" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="flex-1" />
            <Input label="직무" placeholder="백엔드 개발자" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} className="flex-1" />
          </div>
          <Input label="이메일" type="email" placeholder="person@partner.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input label="연락처" placeholder="010-1234-5678" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setAddOpen(false)}>취소</Button>
            <Button type="submit" variant="primary" loading={addPersonnel.isPending}>등록</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
