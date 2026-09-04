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
            <h1 className="text-2xl font-bold mb-6">ØµÙØ­Ø© ÙØ­Øµ ØªØ¹ÙŠÙŠÙ†Ø§Øª Ø§Ù„Ù…Ù†Ø§Ø¯ÙŠØ¨ (Debug)</h1>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                <div>
                    <h2 className="text-xl font-bold mb-4">1. Ø§Ù„Ù…Ù†Ø§Ø¯ÙŠØ¨ (Couriers)</h2>
                    <table className="w-full border collapse">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="border p-2">ID</th>
                                <th className="border p-2">Ø§Ù„Ø§Ø³Ù…</th>
                                <th className="border p-2">Ø§Ù„Ù…Ø³Ø¤ÙˆÙ„ÙŠÙ† (Supervisor IDs)</th>
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
                    <h2 className="text-xl font-bold mb-4">2. Ø§Ù„Ù…Ø³Ø¤ÙˆÙ„ÙŠÙ† (Supervisors)</h2>
                    <table className="w-full border collapse">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="border p-2">ID</th>
                                <th className="border p-2">Ø§Ù„Ø§Ø³Ù…</th>
                                <th className="border p-2">Ø¹Ø¯Ø¯ Ø§Ù„Ù…Ù†Ø§Ø¯ÙŠØ¨ Ø§Ù„Ù…Ø­Ø³ÙˆØ¨</th>
                                <th className="border p-2">Ø£Ø³Ù…Ø§Ø¡ Ø§Ù„Ù…Ù†Ø§Ø¯ÙŠØ¨</th>
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
