import {
    IconAperture,
    IconCopy,
    IconLayoutDashboard,
    IconLogin,
    IconMoodHappy,
    IconTypography,
    IconUserPlus,
} from "@tabler/icons-react";
import { uniqueId } from "lodash";
import type { Schema } from '@/amplify/data/resource';
import { generateClient } from 'aws-amplify/data';
import { useEffect, useState } from "react";

const client = generateClient<Schema>();

const Menuitems = [
    // {
    //     navlabel: true,
    //     subheader: "HOME",
    // },
    // {
    //     id: uniqueId(),
    //     title: "Dashboard",
    //     icon: IconLayoutDashboard,
    //     href: "/",
    // },
    {
        navlabel: true,
        subheader: "カテゴリー",
    },
    {
        id: uniqueId(),
        title: "Typography",
        icon: IconTypography,
        href: "/utilities/typography",
    },
    // {
    //     id: uniqueId(),
    //     title: "Shadow",
    //     icon: IconCopy,
    //     href: "/utilities/shadow",
    // },
    // {
    //     navlabel: true,
    //     subheader: "AUTH",
    // },
    // {
    //     id: uniqueId(),
    //     title: "Login",
    //     icon: IconLogin,
    //     href: "/authentication/login",
    // },
    // {
    //     id: uniqueId(),
    //     title: "Register",
    //     icon: IconUserPlus,
    //     href: "/authentication/register",
    // },
    // {
    //     navlabel: true,
    //     subheader: " EXTRA",
    // },
    // {
    //     id: uniqueId(),
    //     title: "Icons",
    //     icon: IconMoodHappy,
    //     href: "/icons",
    // },
    // {
    //     id: uniqueId(),
    //     title: "Sample Page",
    //     icon: IconAperture,
    //     href: "/sample-page",
    // }
];

export default Menuitems;
