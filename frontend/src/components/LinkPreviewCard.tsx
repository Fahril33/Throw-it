import React from "react";

export type LinkPreview = {
  ok: boolean;
  url: string;
  displayUrl: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
};

export default function LinkPreviewCard(props: { preview: LinkPreview }) {
  if (!props.preview?.ok) return null;

  return (
    <a className="linkCard" href={props.preview.url} target="_blank" rel="noreferrer">
      <div className="linkCardTop">
        <div className="linkCardHost">{props.preview.siteName ?? props.preview.displayUrl}</div>
        <div className="linkCardUrl">{props.preview.displayUrl}</div>
      </div>
      {props.preview.title ? <div className="linkCardTitle">{props.preview.title}</div> : null}
      {props.preview.description ? <div className="linkCardDesc">{props.preview.description}</div> : null}
      {props.preview.image ? (
        <div className="linkCardImgWrap">
          <img className="linkCardImg" src={props.preview.image} alt="" loading="lazy" />
        </div>
      ) : null}
    </a>
  );
}

