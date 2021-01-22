import type { requestModel } from "helpers/requestModel";
import { observer } from "mobx-react";
import * as React from "react";

import Bottom from "./bottom";
import Content from "./content";
import Header from "./header";
import s from "./requestCard.scss";
import type { TabKeys } from "./tabs";
import Tabs from "./tabs";

interface CardProps {
  model: requestModel;
}

function Card(props: CardProps) {
  const [open, setOpen] = React.useState<boolean>(false);
  const [activeTab, setActiveTab] = React.useState<TabKeys>("arguments");
  const [jsonArgs, setJsonArgs] = React.useState<any>(props.model.args);
  const { args, status } = props.model;

  if (!open) {
    return (
      <div role="button" className={s.closedCard} onClick={() => setOpen(true)}>
        <Header open={false} model={props.model} />
      </div>
    );
  }

  return (
    <div className={s.openCard}>
      <Header open closeCard={() => setOpen(false)} model={props.model} />
      <Tabs activeTab={activeTab} onChangeTab={setActiveTab} />
      <Content activeTab={activeTab} args={args} setJsonArgs={setJsonArgs} model={props.model} />
      <Bottom
        status={status}
        onClick={() => {
          props.model.reset();
          props.model.call(jsonArgs, newStatus => (newStatus === "success" ? setActiveTab("response") : setActiveTab("error")));
        }}
      />
    </div>
  );
}

export const RequestCard = observer(Card);
