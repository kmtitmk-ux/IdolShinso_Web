type Props = {
  description?: string;
  children: React.ReactNode;
  title?: string;
};

const PageContainer = ({ title, description, children }: Props) => {
  return (
    <>
      {children}
    </>
  );
};
export default PageContainer;
