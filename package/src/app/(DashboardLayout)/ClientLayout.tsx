"use client";
import { Container, Box } from "@mui/material";
import React, { useState } from "react";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v14-appRouter";
import Header from "@/app/(DashboardLayout)/layout/header/Header";
import Sidebar from "@/app/(DashboardLayout)/layout/sidebar/Sidebar";
import { Amplify } from 'aws-amplify';
import outputs from '@/amplify_outputs.json';
Amplify.configure(outputs);

export default function ClientLayout({ children }: { children: React.ReactNode; }) {
    const [isSidebarOpen, setSidebarOpen] = useState(true);
    const [isMobileSidebarOpen, setMobileSidebarOpen] = useState(false);
    return (
        <>
            <AppRouterCacheProvider>
                <Box style={{
                    flexGrow: 1,
                    padding: "24px",
                    minHeight: "100vh"
                }}>
                    {/* ------------------------------------------- */}
                    {/* Sidebar */}
                    {/* ------------------------------------------- */}
                    <Sidebar
                        isSidebarOpen={isSidebarOpen}
                        isMobileSidebarOpen={isMobileSidebarOpen}
                        onSidebarClose={() => setMobileSidebarOpen(false)}
                    />
                    {/* ------------------------------------------- */}
                    {/* Main Wrapper */}
                    {/* ------------------------------------------- */}
                    <Box
                        className="pageWrapper"
                        style={{
                            backgroundColor: "transparent",
                            display: "flex",
                            flexGrow: 1,
                            flexDirection: "column",
                            paddingBottom: "60px",
                            zIndex: 1,
                        }}>
                        {/* ------------------------------------------- */}
                        {/* Header */}
                        {/* ------------------------------------------- */}
                        <Header toggleMobileSidebar={() => setMobileSidebarOpen(true)} />
                        {/* ------------------------------------------- */}
                        {/* PageContent */}
                        {/* ------------------------------------------- */}
                        <Container
                            sx={{
                                paddingTop: "20px",
                                maxWidth: "1200px",
                            }}
                        >
                            {/* ------------------------------------------- */}
                            {/* Page Route */}
                            {/* ------------------------------------------- */}
                            <Box sx={{ minHeight: "calc(100vh - 170px)" }}>{children}</Box>
                            {/* ------------------------------------------- */}
                            {/* End Page */}
                            {/* ------------------------------------------- */}
                        </Container>
                    </Box>
                </Box>
            </AppRouterCacheProvider>
        </>
    );
}
