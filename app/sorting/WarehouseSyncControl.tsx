'use client'

import { useState, useEffect, useTransition } from 'react';
import { getJobs } from '@/app/warehouse-actions';

// Define the type for a single Job
interface Job {
    id: string;
    name: string;
    status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
    progress: number;
    logs: string;
    createdAt: string; 
    completedAt?: string | null;
}

// Update the props to include the initial list of jobs
interface SyncControlProps {
    onSyncComplete: () => void;
    initialJobs: Job[];
}

export default function WarehouseSyncControl({ onSyncComplete, initialJobs }: SyncControlProps) {
    const [jobs, setJobs] = useState<Job[]>(initialJobs);
    const [isExecuting, setIsExecuting] = useState(false);
    const [isRefreshing, startRefreshTransition] = useTransition();

    // Function to fetch the latest jobs manually
    const fetchJobs = () => {
        startRefreshTransition(async () => {
            try {
                const latestJobs = await getJobs();
                setJobs(latestJobs);
            } catch (error) {
                console.error("Failed to fetch jobs:", error);
                alert('فشل تحديث قائمة المهام.');
            }
        });
    };

    const handleExecuteJob = async () => {
        if (!confirm('سيتم بدء عملية فرز كاملة في الخلفية. قد تستغرق هذه العملية بعض الوقت. هل أنت متأكد؟')) return;

        setIsExecuting(true);
        try {
            const response = await fetch('/api/jobs/execute', { method: 'POST' });
            const result = await response.json();

            if (response.ok) {
                alert(`تم بدء المهمة بنجاح (ID: ${result.jobId}). قم بتحديث القائمة لرؤية التقدم.`);
                fetchJobs(); // Refresh jobs list immediately after starting one
            } else {
                throw new Error(result.error || 'فشل في بدء المهمة');
            }
        } catch (e: any) {
            alert(`حدث خطأ: ${e.message}`);
        }
        setIsExecuting(false);
    };
    
    const getStatusBadge = (status: Job['status']) => {
        switch(status) {
            case 'PENDING': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
            case 'RUNNING': return 'bg-blue-100 text-blue-800 border-blue-300';
            case 'COMPLETED': return 'bg-green-100 text-green-800 border-green-300';
            case 'FAILED': return 'bg-red-100 text-red-800 border-red-300';
        }
    }

    return (
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-6" dir="rtl">
            
            <div className="flex flex-wrap items-center gap-4">
                <button 
                    onClick={handleExecuteJob}
                    disabled={isExecuting}
                    className={`bg-indigo-600 text-white px-8 py-3 rounded-xl font-black shadow-lg shadow-indigo-100 transition-all active:scale-95 flex items-center gap-2 ${isExecuting ? 'opacity-50 cursor-not-allowed' : 'hover:bg-indigo-700'}`}
                >
                    {isExecuting ? (
                        <><span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span> جاري البدء...</>
                    ) : (
                        <><span>🚀 بدء الفرز الكامل (مهمة خلفية)</span></>
                    )}
                </button>
                <p className='text-xs text-gray-500 max-w-sm'>
                    يقوم هذا الزر بتشغيل عملية حساب الكميات المتاحة والمتبقية لكل الطلبات في الخلفية. استخدمه عندما تريد تحديث شامل للبيانات.
                </p>
            </div>

            {jobs.length > 0 && (
                <div className="w-full pt-4 border-t border-dashed">
                    <div className="flex justify-between items-center mb-3">
                        <h4 className="text-sm font-bold text-gray-700">سجل مهام الخلفية:</h4>
                        <button onClick={fetchJobs} disabled={isRefreshing} className="bg-gray-100 text-gray-600 px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-gray-200 transition-colors disabled:opacity-50 flex items-center gap-2">
                           {isRefreshing ? 'جاري...' : '🔄 تحديث'}
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-right border-collapse">
                            <thead>
                                <tr className="bg-gray-50 text-gray-600 font-semibold">
                                    <th className="p-2 border rounded-t-lg">المهمة</th>
                                    <th className="p-2 border">الحالة</th>
                                    <th className="p-2 border w-48">التقدم</th>
                                    <th className="p-2 border">وقت الإنشاء</th>
                                </tr>
                            </thead>
                            <tbody>
                                {jobs.map((job) => (
                                    <tr key={job.id} className="hover:bg-gray-50">
                                        <td className="p-3 border font-semibold text-gray-800">{job.name}</td>
                                        <td className="p-3 border text-center">
                                            <span className={`px-3 py-1 text-xs font-bold rounded-full border ${getStatusBadge(job.status)}`}>
                                                {job.status}
                                            </span>
                                        </td>
                                        <td className="p-3 border">
                                            <div className="flex items-center gap-2">
                                                <div className="w-full bg-gray-200 rounded-full h-4">
                                                    <div 
                                                        className={`h-4 rounded-full ${job.status === 'FAILED' ? 'bg-red-500' : 'bg-green-500'}`}
                                                        style={{width: `${job.progress}%`}}
                                                    ></div>
                                                </div>
                                                <span className="text-xs font-mono text-gray-500">{job.progress}%</span>
                                            </div>
                                        </td>
                                        <td className="p-3 border text-center text-gray-500 text-xs font-mono" dir="ltr">
                                            {new Date(job.createdAt).toLocaleString('en-GB')}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
