import assert from "node:assert/strict";
import { test } from "node:test";
import { parseYamlToConfig } from "@/lib/config";

test("yaml link without name uses url as name", () => {
  const yaml = `
bookmarkhub:
  - name: 测试模块
    categories:
      - name: 测试分类
        urls:
          - url: https://example.com/tool
            description: 描述
`;

  const config = parseYamlToConfig(yaml);
  assert.ok(config, "配置应被成功解析");

  const bookmark = config?.bookmarks.find((item) => item.url === "https://example.com/tool");
  assert.ok(bookmark, "应找到对应的书签");

  assert.equal(bookmark?.name, "https://example.com/tool");
  assert.equal(bookmark?.description, "描述");
});
