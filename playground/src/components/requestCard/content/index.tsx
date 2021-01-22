import { componentSwitch } from "helpers/componentSwitch";
import type { requestModel } from "helpers/requestModel";
import { observer } from "mobx-react";
import * as React from "react";
import ReactJson from "react-json-view";
import MonacoEditor from "react-monaco-editor";

import { Annotations } from "../annotations";
import { Errors } from "../errors";
import type { TabKeys } from "../tabs";
import s from "./content.scss";

interface ContentProps {
  activeTab: TabKeys;
  args: any;
  setJsonArgs: React.Dispatch<any>;
  model: requestModel;
}

function Content(props: ContentProps) {
  const { activeTab, args, setJsonArgs, model } = props;

  const content = componentSwitch<TabKeys>(activeTab, {
    annotations: (
      <div className={s.responseWrapper}>
        <Annotations annotations={model.annotations} />
      </div>
    ),
    arguments: (
      <MonacoEditor
        height="250"
        language="json"
        theme="vs-light"
        defaultValue={JSON.stringify(args, null, 2)}
        options={{
          minimap: {
            enabled: false,
            renderCharacters: false,
            showSlider: "mouseover",
          },
        }}
        onChange={v => {
          try {
            setJsonArgs(JSON.parse(v));
          } catch (err) {
            console.log("JS-1", err);
          }
        }}
      />
    ),
    default: (
      <div className={s.responseWrapper}>
        <p>
          Did you know this is a <b>work in progress?</b>
        </p>
        <p>... well, now you know.</p>
      </div>
    ),
    error: (
      <div className={s.responseWrapper}>
        <Errors error={model.error} />
      </div>
    ),
    response: (
      <div className={s.responseWrapper}>
        <ReactJson src={model.response === undefined ? {} : { response: model.response }} name={false} />
      </div>
    ),
  });

  return <div className={s.content}>{content}</div>;
}

export default observer(Content);
