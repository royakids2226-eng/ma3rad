"use client";
import Link from "next/link";

export default function NewOrderButton() {
    return (
        <Link href="/orders/new">
            <button className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded">
                أوردر جديد
            </button>
        </Link>
    );
}
