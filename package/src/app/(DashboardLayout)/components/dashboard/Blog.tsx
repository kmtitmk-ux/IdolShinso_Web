import Link from "next/link";
import {
    CardContent,
    Button,
    Typography,
    Grid,
    Rating,
    Tooltip,
    Fab,
    Avatar
} from "@mui/material";
// import img1 from "public/images/products/s4.jpg";
// import img2 from "public/images/products/s5.jpg";
// import img3 from "public/images/products/s7.jpg";
// import img4 from "public/images/products/s11.jpg";
import { Stack } from "@mui/system";
import { IconBasket } from "@tabler/icons-react";
import BlankCard from "@/app/(DashboardLayout)/components/shared/BlankCard";
import { serverClient } from "@/utils/serverClient";
import Image from "next/image";
import dayjs from 'dayjs';

// const client = generateClient<Schema>();

// const ecoCard = [
//     {
//         title: "Boat Headphone",
//         slug: "September 14, 2023",
//         photo: '/images/products/s4.jpg',
//         salesPrice: 375,
//         price: 285,
//         rating: 4,
//     },
//     {
//         title: "MacBook Air Pro",
//         slug: "September 14, 2023",
//         photo: '/images/products/s5.jpg',
//         salesPrice: 650,
//         price: 900,
//         rating: 5,
//     },
//     {
//         title: "Red Valvet Dress",
//         slug: "September 14, 2023",
//         photo: '/images/products/s7.jpg',
//         salesPrice: 150,
//         price: 200,
//         rating: 3,
//     },
//     {
//         title: "Cute Soft Teddybear",
//         slug: "September 14, 2023",
//         photo: '/images/products/s11.jpg',
//         salesPrice: 285,
//         price: 345,
//         rating: 2,
//     },
//     {
//         title: "Boat Headphone",
//         slug: "September 14, 2023",
//         photo: '/images/products/s4.jpg',
//         salesPrice: 375,
//         price: 285,
//         rating: 4,
//     },
//     {
//         title: "MacBook Air Pro",
//         slug: "September 14, 2023",
//         photo: '/images/products/s5.jpg',
//         salesPrice: 650,
//         price: 900,
//         rating: 5,
//     },
//     {
//         title: "Red Valvet Dress",
//         slug: "September 14, 2023",
//         photo: '/images/products/s7.jpg',
//         salesPrice: 150,
//         price: 200,
//         rating: 3,
//     },
//     {
//         title: "Cute Soft Teddybear",
//         slug: "September 14, 2023",
//         photo: '/images/products/s11.jpg',
//         salesPrice: 285,
//         price: 345,
//         rating: 2,
//     }
// ];


const Blog = async () => {
    const { data } = await serverClient.models.IS01.list({
        selectionSet: [
            "id",
            "title",
            "createdAt",
            "categories.id",
            "categories.name"
        ]
    });
    console.info("fetch data:", data[0].categories);
    const ecoCard: any[] = [];
    return (
        <Grid container spacing={3}>
            {data?.map((product: any, index: number) => (
                <Grid
                    key={index}
                    size={{
                        xs: 12,
                        md: 4,
                        lg: 3
                    }}>
                    <BlankCard>
                        <Typography component={Link} href={`/posts/${product.slug}`}>
                            {/* <Avatar
                                src={product.photo} variant="square"
                                sx={{
                                    height: 250,
                                    width: '100%',
                                }}
                            /> */}
                        </Typography>
                        {/* <Tooltip title="Add To Cart">
                            <Fab
                                size="small"
                                color="primary"
                                sx={{ bottom: "75px", right: "15px", position: "absolute" }}
                            >
                                <IconBasket size="16" />
                            </Fab>
                        </Tooltip> */}
                        <CardContent sx={{ p: 3, pt: 2 }}>
                            <Typography variant="h6">{product.title}</Typography>
                            <Stack
                                direction="row"
                                alignItems="center"
                                justifyContent="space-between"
                                mt={1}
                            >
                                <Stack direction="row" alignItems="center">
                                    <Typography>{dayjs(product.createdAt).format("YYYY/MM/DD")}</Typography>
                                    {/* <Typography
                                        color="textSecondary"
                                        ml={1}
                                        sx={{ textDecoration: "line-through" }}
                                    >
                                        {product.createdAt}
                                    </Typography> */}
                                </Stack>
                                <Button size="small">カテゴリー</Button>

                                {/* <Rating
                                    name="read-only"
                                    size="small"
                                    value={product.rating}
                                    readOnly
                                /> */}
                            </Stack>
                        </CardContent>
                    </BlankCard>
                </Grid>
            ))}
        </Grid>
    );
};

export default Blog;
