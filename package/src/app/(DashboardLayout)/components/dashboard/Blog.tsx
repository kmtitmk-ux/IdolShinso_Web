import Link from "next/link";
import {
    CardContent,
    Button,
    Typography,
    Grid,
    Rating,
    Tooltip,
    Fab,
    Avatar,
    Pagination
} from "@mui/material";
// import img1 from "public/images/products/s4.jpg";
// import img2 from "public/images/products/s5.jpg";
// import img3 from "public/images/products/s7.jpg";
// import img4 from "public/images/products/s11.jpg";
import { Stack } from "@mui/system";
import { IconBasket } from "@tabler/icons-react";
import BlankCard from "@/app/(DashboardLayout)/components/shared/BlankCard";
import { cookiesClient } from "@/utils/amplifyServerUtils";
import Image from "next/image";
import dayjs from 'dayjs';
import outputs from '@/amplify_outputs.json';
import { getUrl } from 'aws-amplify/storage';


// const data = [
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
const bucketName01 = outputs.storage.bucket_name; // package/amplify_outputs.json

const Blog = async ({ searchParams, nextToken }: { searchParams: { page?: string; }; nextToken: string; }) => {
    const { page } = searchParams;
    const currentPage = parseInt(page || "1", 10);
    console.info("searchParams:", searchParams);
    console.info("nextToken", nextToken);
    console.info("currentPage:", currentPage);
    const { data } = await cookiesClient.models.IS01.list({
        selectionSet: [
            "id",
            "slug",
            "title",
            "rewrittenTitle",
            "thumbnail",
            "createdAt",
            "categories.id",
            "categories.name"
        ],
        // nextToken,
    });

    // // データをフォーマット
    // const formattedData = data.map((item) => ({
    //     ...item,
    //     createdAt: item.createdAt ? new Date(item.createdAt).toISOString() : "",
    //     thumbnail: item.thumbnail || "/images/fallback.jpg", // フォールバック画像
    // }));
    // console.info("fetch data:", formattedData);

    return (
        <>
            {data?.map((product: any, index: number) => (
                <Grid key={index}>
                    <BlankCard>
                        {/* <Typography>
                            <Avatar
                                src={product.photo} variant="square"
                                sx={{
                                    height: 250,
                                    width: '100%',
                                }}
                            />
                        </Typography> */}
                        <Link href={`/posts/${product.slug ?? ""}`}>
                            <Image
                                src={`https://${bucketName01}.s3.ap-northeast-1.amazonaws.com/${product.thumbnail ?? ""}`}
                                alt={product.title}
                                width={400}
                                height={250}
                                style={{
                                    width: '100%',
                                    height: 'auto',
                                    objectFit: 'cover'
                                }}
                            />
                        </Link>
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
                            <Typography component={Link} href={`/posts/${product.slug ?? ""}`} variant="h6">
                                {product.rewrittenTitle ?? ""}
                            </Typography>
                            <Stack
                                direction="row"
                                alignItems="center"
                                justifyContent="space-between"
                                mt={1}
                            >
                                <Stack direction="row" alignItems="center">
                                    <Typography>{dayjs(product?.createdAt ?? "").format("YYYY/MM/DD")}</Typography>
                                    {/* <Typography
                                        color="textSecondary"
                                        ml={1}
                                        sx={{ textDecoration: "line-through" }}
                                    >
                                        {product.createdAt}
                                    </Typography> */}
                                </Stack>
                                <Button size="small">
                                    {product?.categories[0]?.name ?? ""}
                                </Button>
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
        </>
    );
};

export default Blog;
