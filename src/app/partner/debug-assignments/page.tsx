"use client";

import { useEffect, useState } from "react";
import { apiCall } from "@/lib/api";

export default function DebugAssignmentsPage() {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await apiCall('/halan/users');
                setUsers(res.success ? res.data : []);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    if (loading) return <div className="p-10">Loading raw data...</div>;

    const couriers = users.filter(u => u.role === 'courier');
    const supervisors = users.filter(u => u.role === 'supervisor');

    return (
        <div className="p-10 bg-white min-h-screen text-black" dir="rtl">
            <h1 className="text-2xl font-bold mb-6">صفحة فحص تعيينات المناديب (Debug)</h1>

            <div className="grid grid-cols-2 gap-8">
                <div>
                    <h2 className="text-xl font-bold mb-4">1. المناديب (Couriers)</h2>
                    <table className="w-full border collapse">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="border p-2">ID</th>
                                <th className="border p-2">الاسم</th>
                                <th className="border p-2">المسؤولين (Supervisor IDs)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {couriers.map(c => (
                                <tr key={c.id}>
                                    <td className="border p-2">{c.id}</td>
                                    <td className="border p-2 font-bold">{c.name}</td>
                                    <td className="border p-2 ltr text-left">
                                        {JSON.stringify(c.supervisorIds)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div>
                    <h2 className="text-xl font-bold mb-4">2. المسؤولين (Supervisors)</h2>
                    <table className="w-full border collapse">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="border p-2">ID</th>
                                <th className="border p-2">الاسم</th>
                                <th className="border p-2">عدد المناديب المحسوب</th>
                                <th className="border p-2">أسماء المناديب</th>
                            </tr>
                        </thead>
                        <tbody>
                            {supervisors.map(s => {
                                // Strict type conversion check
                                const assigned = couriers.filter(c =>
                                    (c.supervisorIds || []).map((id: any) => Number(id)).includes(Number(s.id))
                                );
                                return (
                                    <tr key={s.id}>
                                        <td className="border p-2">{s.id}</td>
                                        <td className="border p-2 font-bold">{s.name}</td>
                                        <td className="border p-2 text-center text-xl font-bold text-blue-600">
                                            {assigned.length}
                                        </td>
                                        <td className="border p-2 text-sm text-gray-600">
                                            {assigned.map(c => c.name).join(', ')}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
