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
import Image from "next/image";
import dayjs from 'dayjs';
import outputs from '@/amplify_outputs.json';
const bucketName01 = outputs?.storage?.bucket_name; // package/amplify_outputs.json

const Blog = ({
    data,
    lang
}: {
    data: any[];
    lang: string;
}) => {
    console.log("Blog data", data);
    return (
        <>
            {data.map((product: any, index: number) => {
                const postmeta = product?.postmeta[0] ?? [];
                const postLink = lang === "ja" ? `/posts/${product.slug}` : `/${lang}/posts/${product.slug}`;
                const termLink = lang === "ja" ? `/category/${postmeta.slug}` : `/${lang}/category/${postmeta.slug}`;
                return (
                    <Grid key={index} size={{ xs: 12, md: 4, lg: 3 }}>
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
                            <Link href={postLink}>
                                <div style={{ width: '100%', height: 150, position: 'relative' }}>
                                    <Image
                                        src={`https://${bucketName01}.s3.ap-northeast-1.amazonaws.com/${product.thumbnail as string}`}
                                        alt={product?.rewrittenTitle || product?.title}
                                        fill
                                        style={{ objectFit: 'cover' }}
                                    />
                                </div>
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
                                <Typography component={Link} href={postLink} variant="h6">
                                    {product?.rewrittenTitle || product?.title}
                                </Typography>
                                <Stack
                                    direction="row"
                                    alignItems="center"
                                    justifyContent="space-between"
                                    mt={1}
                                >
                                    <Stack direction="row" alignItems="center">
                                        <Typography>{dayjs(product?.createdAt ?? "").format("YYYY/M/D")}</Typography>
                                        {/* <Typography
                                            color="textSecondary"
                                            ml={1}
                                            sx={{ textDecoration: "line-through" }}
                                        >
                                            {product.createdAt}
                                        </Typography> */}
                                    </Stack>
                                    <Button component={Link} href={termLink} size="small">
                                        {postmeta?.name ?? ""}
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
                );
            })}
        </>
    );
};

export default Blog;
