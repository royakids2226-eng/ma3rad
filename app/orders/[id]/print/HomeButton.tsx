"use client";
import Link from "next/link";

export default function HomeButton() {
    return (
        <Link href="/">
            <button className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded">
                الرئيسية
            </button>
        </Link>
    );
}
