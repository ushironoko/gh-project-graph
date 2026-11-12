const refIssue = `
fragment RefIssue on Issue {
  __typename id number title url state stateReason createdAt closedAt
  repository { nameWithOwner }
}`;

const refPr = `
fragment RefPr on PullRequest {
  __typename id number title url state isDraft merged createdAt closedAt mergedAt
  baseRefName headRefName
  repository { nameWithOwner }
  headRepository { nameWithOwner }
}`;

const projectItems = `
query ProjectItems($owner: String!, $number: Int!, $after: String) {
  repositoryOwner(login: $owner) {
    ... on User { projectV2(number: $number) { ...ProjectPage } }
    ... on Organization { projectV2(number: $number) { ...ProjectPage } }
  }
}

fragment ProjectPage on ProjectV2 {
  id title url
  items(first: 100, after: $after) {
    totalCount
    pageInfo { hasNextPage endCursor }
    nodes {
      id isArchived createdAt
      status: fieldValueByName(name: "Status") {
        ... on ProjectV2ItemFieldSingleSelectValue { name color }
      }
      content {
        __typename
        ... on DraftIssue { id title createdAt updatedAt }
        ... on Issue {
          ...RefIssue
          parent { ...RefIssue }
          duplicateOf { ...RefIssue }
          subIssues(first: 50) { nodes { ...RefIssue } }
          blockedBy(first: 25) { nodes { ...RefIssue } }
          blocking(first: 25) { nodes { ...RefIssue } }
          relatesTo(first: 25) { nodes { ...RefIssue } }
          closedByPullRequestsReferences(first: 10, includeClosedPrs: true) { nodes { ...RefPr } }
        }
        ... on PullRequest {
          ...RefPr
          closingIssuesReferences(first: 25) { nodes { ...RefIssue } }
          stack {
            id number baseRefName
            entries(first: 50) { nodes { position pullRequest { ...RefPr } } }
          }
        }
      }
    }
  }
}
${refIssue}
${refPr}`;

const itemDetail = `
query ItemDetail($contentId: ID!, $itemId: ID!) {
  content: node(id: $contentId) {
    __typename
    ... on DraftIssue {
      body
      creator { login avatarUrl }
      assignees(first: 10) { nodes { login avatarUrl } }
    }
    ... on Issue {
      bodyHTML updatedAt
      author { login avatarUrl }
      assignees(first: 10) { nodes { login avatarUrl } }
      labels(first: 20) { nodes { name color } }
      milestone { title dueOn }
      issueType { name color }
      subIssuesSummary { total completed percentCompleted }
      issueDependenciesSummary { blockedBy blocking }
      comments(last: 3) { totalCount nodes { author { login avatarUrl } bodyText createdAt url } }
    }
    ... on PullRequest {
      bodyHTML updatedAt
      author { login avatarUrl }
      assignees(first: 10) { nodes { login avatarUrl } }
      labels(first: 20) { nodes { name color } }
      milestone { title dueOn }
      additions deletions changedFiles
      reviewDecision mergeStateStatus
      mergedBy { login }
      commits(last: 1) { totalCount nodes { commit { statusCheckRollup { state } } } }
      latestReviews(first: 10) { nodes { author { login avatarUrl } state } }
      reviewRequests(first: 10) { nodes { requestedReviewer { ... on User { login } ... on Team { name } } } }
      comments(last: 3) { totalCount nodes { author { login avatarUrl } bodyText createdAt url } }
    }
  }
  item: node(id: $itemId) {
    ... on ProjectV2Item {
      fieldValues(first: 30) {
        nodes {
          __typename
          ... on ProjectV2ItemFieldSingleSelectValue { name field { ... on ProjectV2FieldCommon { name } } }
          ... on ProjectV2ItemFieldTextValue { text field { ... on ProjectV2FieldCommon { name } } }
          ... on ProjectV2ItemFieldNumberValue { number field { ... on ProjectV2FieldCommon { name } } }
          ... on ProjectV2ItemFieldDateValue { date field { ... on ProjectV2FieldCommon { name } } }
          ... on ProjectV2ItemFieldIterationValue { title startDate duration field { ... on ProjectV2FieldCommon { name } } }
        }
      }
    }
  }
}`;

export const operations = {
  ProjectItems: projectItems,
  ItemDetail: itemDetail,
} as const;

export type OperationName = keyof typeof operations;

export const isOperationName = (value: unknown): value is OperationName =>
  typeof value === "string" && Object.hasOwn(operations, value);
