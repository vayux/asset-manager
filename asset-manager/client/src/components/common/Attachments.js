import React, { useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { PaperClipIcon, TrashIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import api from '../../api/client';

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = 'application/pdf,image/png,image/jpeg,image/webp';
const sizeLabel = (bytes) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
const errorMessage = (err, fallback) => err.response?.data?.message || err.response?.data?.errors?.[0]?.msg || fallback;

const Attachments = ({ entityType, entityId }) => {
  const queryClient = useQueryClient();
  const inputRef = useRef(null);
  const key = ['attachments', entityType, entityId];
  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: async () => (await api.get(`/api/attachments?entityType=${entityType}&entityId=${entityId}`)).data.attachments,
    enabled: Boolean(entityId),
  });

  const upload = useMutation({
    mutationFn: (file) => {
      const form = new FormData();
      form.append('entityType', entityType);
      form.append('entityId', entityId);
      form.append('file', file);
      return api.post('/api/attachments', form);
    },
    onSuccess: () => { toast.success('File attached'); queryClient.invalidateQueries({ queryKey: key }); },
    onError: (err) => toast.error(errorMessage(err, 'Upload failed')),
  });
  const remove = useMutation({
    mutationFn: (id) => api.delete(`/api/attachments/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
    onError: (err) => toast.error(errorMessage(err, 'Could not delete file')),
  });

  const onPick = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_BYTES) { toast.error('Files can be at most 10 MB'); return; }
    upload.mutate(file);
  };

  const download = async (att) => {
    try {
      const res = await api.get(`/api/attachments/${att.id}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = att.fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error('Download failed');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Documents</h3>
        <button type="button" className="btn-secondary text-sm inline-flex items-center gap-1" disabled={upload.isPending} onClick={() => inputRef.current?.click()}>
          <PaperClipIcon className="h-4 w-4" /> {upload.isPending ? 'Uploading…' : 'Attach file'}
        </button>
        <input ref={inputRef} type="file" accept={ACCEPT} className="hidden" data-testid="attachment-input" onChange={onPick} />
      </div>
      <p className="text-xs text-gray-500">PDF or image, up to 10 MB. Only you can download these.</p>
      {isLoading && <p className="text-sm text-gray-500">Loading…</p>}
      {data?.length === 0 && <p className="text-sm text-gray-500">No documents yet.</p>}
      <ul className="divide-y">
        {data?.map((att) => (
          <li key={att.id} className="flex items-center justify-between py-2 text-sm">
            <span className="truncate">{att.fileName} <span className="text-gray-400">({sizeLabel(att.sizeBytes)})</span></span>
            <span className="flex gap-2">
              <button type="button" aria-label={`Download ${att.fileName}`} className="text-primary-600" onClick={() => download(att)}><ArrowDownTrayIcon className="h-4 w-4" /></button>
              <button type="button" aria-label={`Delete ${att.fileName}`} className="text-danger-600" onClick={() => remove.mutate(att.id)}><TrashIcon className="h-4 w-4" /></button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Attachments;
