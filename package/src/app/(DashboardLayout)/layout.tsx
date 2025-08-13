import { Container, Box } from "@mui/material";
import ClientLayout from "./ClientLayout";
import React from "react";

export default function RootLayout({ children }: { children: React.ReactNode; }) {
    return (
        <>
            <ClientLayout>
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
            </ClientLayout>
        </>
    );
}
