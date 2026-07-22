interface ButtonLoaderProps {
  loading: boolean;
  loadingText: string;
  children: string;
}

const ButtonLoader = ({ loading, loadingText, children }: ButtonLoaderProps) => {
  if (!loading) return <>{children}</>;
  return (
    <>
      <span className="button-spinner" aria-hidden="true" />
      <span>{loadingText}</span>
    </>
  );
};

export default ButtonLoader;
