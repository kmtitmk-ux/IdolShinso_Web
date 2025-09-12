"use client";
import React, { useEffect, useState } from "react";
// import Menuitems from "./MenuItems";
import {
    IconCircleChevronRight,
    // IconAperture,
    // IconCopy,
    // IconLayoutDashboard,
    // IconLogin,
    // IconMoodHappy,
    // IconUserPlus
} from "@tabler/icons-react";
import { Box, Typography } from "@mui/material";
import {
    Logo,
    Sidebar as MUI_Sidebar,
    Menu,
    MenuItem,
    Submenu,
} from "react-mui-sidebar";
import { IconPoint } from '@tabler/icons-react';
import Link from "next/link";
import { usePathname } from "next/navigation";
import { uniqueId } from "lodash";
import { Upgrade } from "./Updrade";
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource';

type SidebarMenuItem = {
    navlabel?: boolean;
    subheader?: string;
    id?: string;
    title?: string | null; // null を許容
    icon?: React.ElementType;
    href?: string;
};
const renderMenuItems = (items: SidebarMenuItem[], pathDirect: any) => {
    return items.map((item: any) => {
        const Icon = item.icon ? item.icon : IconPoint;
        const itemIcon = <Icon stroke={1.5} size="1.3rem" />;
        if (item.subheader) {
            // Display Subheader
            return (
                <Menu
                    subHeading={item.subheader}
                    key={item.subheader}
                />
            );
        }
        //If the item has children (submenu)
        if (item.children) {
            return (
                <Submenu
                    key={item.id}
                    title={item.title}
                    icon={itemIcon}
                    borderRadius='7px'
                >
                    {renderMenuItems(item.children, pathDirect)}
                </Submenu>
            );
        }
        // If the item has no children, render a MenuItem
        return (
            <Box px={3} key={item.id}>
                <MenuItem
                    key={item.id}
                    isSelected={pathDirect === item?.href}
                    borderRadius='8px'
                    icon={itemIcon}
                    link={item.href}
                    component={Link}
                >
                    {item.title}
                </MenuItem >
            </Box>
        );
    });
};

const SidebarItems = () => {
    const pathname = usePathname();
    const pathDirect = pathname;
    const [menuitems, setMenuitems] = useState<SidebarMenuItem[]>([
        {
            id: uniqueId(),
            navlabel: true,
            subheader: "カテゴリー",
        },
        // {
        //     id: uniqueId(),
        //     title: "Typography",
        //     icon: IconCircleChevronRight ,
        //     href: "/utilities/typography",
        // }
    ]);
    const client = generateClient<Schema>();

    useEffect(() => {
        const fetchData = async () => {
            const { data, errors } = await client.models.IsTerms.listIsTermsByTaxonomy({
                // nextToken: nextToken || undefined,
                taxonomy: "category"
            });
            console.info("fetched sidebar:", data);
            if (errors) {
                console.error(errors);
                return;
            }
            const mapped: SidebarMenuItem[] = data.map((item) => ({
                id: item.id,
                title: item.name,
                icon: IconCircleChevronRight,
                href: `/${item.taxonomy}/${item.slug}`,
            }));
            // 初期固定メニュー + API 取得カテゴリをマージ
            setMenuitems((prev: SidebarMenuItem[]) => {
                const existingTitles = new Set(prev.map(i => i.title));
                const filtered = mapped.filter(item => !existingTitles.has(item.title));
                return [...prev, ...filtered];
            });
        };
        fetchData();
    }, []);

    return (
        <>
            <MUI_Sidebar width={"100%"} showProfile={false} themeColor={"#5D87FF"} themeSecondaryColor={'#49beff'} >
                <Logo img='/images/logos/dark-logo.svg' component={Link} to="/" >aaa</Logo>
                {renderMenuItems(menuitems, pathDirect)}
                {/* <Box px={2}>
                    <Upgrade />
                </Box> */}
            </MUI_Sidebar>
        </>
    );
};
export default SidebarItems;
