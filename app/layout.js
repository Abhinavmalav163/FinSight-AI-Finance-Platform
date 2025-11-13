import { Inter } from "next/font/google";
import "./globals.css";
import RootLayoutWrapper from "@/components/RootLayoutWrapper";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "FinSight AI",
  description: "One stop solution for financial insights and analysis",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${inter.className}`}>
        <RootLayoutWrapper>{children}</RootLayoutWrapper>
        {/*footer*/}
        <footer className="bg-blue-50 py-12">
          <div className="container mx-auto px-4 text-center text-gray-600">
            <p>Made to keep your financial records</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
