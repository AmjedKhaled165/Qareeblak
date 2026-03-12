import { Metadata } from 'next';
import React from 'react';

// This is a Server Component Layout
// It can fetch data directly from the DB or API for SEO before the client page loads

async function getProviderMinimal(id: string) {
    const API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
    try {
        const res = await fetch(`${API_URL}/providers/${id}`, { next: { revalidate: 3600 } });
        if (!res.ok) return null;
        return res.json();
    } catch (e) {
        return null;
    }
}

export async function generateMetadata(props: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const params = await props.params;
    const provider = await getProviderMinimal(params.id);

    if (!provider) {
        return {
            title: 'مقدم خدمة - قريبلك',
            description: 'تصفح خدمات الصيانة والمناديب في منطقتك'
        };
    }

    const title = `${provider.name} | ${provider.category} في ${provider.location} - قريبلك`;
    const description = `اطلب خدمات ${provider.name} (${provider.category}) الآن. ${provider.reviews_count || 0} تقييم، متاح في ${provider.location}. صيانة، مناديب، وتوصيل بجودة عالية.`;

    return {
        title,
        description,
        openGraph: {
            title,
            description,
            images: provider.image_url ? [provider.image_url] : [],
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
        }
    };
}

export default async function ProviderLayout(props: { 
    children: React.ReactNode;
    params: Promise<{ id: string }>;
}) {
    // We don't necessarily NEED to await params here just to render children,
    // but it ensures the layout waits appropriately for dynamic routes
    const params = await props.params;
    return <>{props.children}</>;
}
