import styled from 'styled-components/macro';
import tw from 'twin.macro';
import Checkbox from '@/components/elements/Checkbox';
import React from 'react';
import { useStoreState } from 'easy-peasy';
import Label from '@/components/elements/Label';
import i18n from '@/i18n';

const Container = styled.label`
    ${tw`flex items-center border border-transparent rounded md:p-2 transition-colors duration-75`};
    text-transform: none;

    &:not(.disabled) {
        ${tw`cursor-pointer`};

        &:hover {
            ${tw`border-neutral-500 bg-neutral-800`};
        }
    }

    &:not(:first-of-type) {
        ${tw`mt-4 sm:mt-2`};
    }

    &.disabled {
        ${tw`opacity-50`};

        & input[type='checkbox']:not(:checked) {
            ${tw`border-0`};
        }
    }
`;

interface Props {
    permission: string;
    disabled: boolean;
}

const PermissionRow = ({ permission, disabled }: Props) => {
    const [key, permissionKey] = permission.split('.', 2);
    const permissions = useStoreState((state) => state.permissions.data);
    const description = permissions[key].keys[permissionKey];

    return (
        <Container htmlFor={`permission_${permission}`} className={disabled ? 'disabled' : undefined}>
            <div css={tw`p-2`}>
                <Checkbox
                    id={`permission_${permission}`}
                    name={'permissions'}
                    value={permission}
                    css={tw`w-5 h-5 mr-2`}
                    disabled={disabled}
                />
            </div>
            <div css={tw`flex-1`}>
                <Label as={'p'} css={tw`font-medium`}>
                    {i18n.t(`frontend:permissionAction_${permissionKey.replace('-', '_')}`, {
                        defaultValue: permissionKey,
                    })}
                </Label>
                {description.length > 0 && (
                    <p css={tw`text-xs text-neutral-400 mt-1`}>
                        {i18n.t(`frontend:permissionDescription_${key}_${permissionKey.replace('-', '_')}`, {
                            defaultValue: description,
                        })}
                    </p>
                )}
            </div>
        </Container>
    );
};

export default PermissionRow;
